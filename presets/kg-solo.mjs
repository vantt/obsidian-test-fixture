// Knowledge-graph vault of a one-person consulting business: clients, contacts that change over time, projects,
// contracts that get renewed, meetings and decisions that get reversed, a causal model of the business with
// reinforcing and balancing loops, claims with sources, LLM proposals, and planted schema errors.
// `.kg-answers.json` holds the schema and the answer key: one case per query, grouped by problem (BT1-BT12 of
// obsidian-pkm-automation docs/knowledge-graph). Every answer is computed by lib/kg.mjs over the written files;
// test/kg.test.mjs checks the hand-designed core cases against hand-written answers.
import { createRng } from '../lib/prng.mjs';
import { loadKg, norm, runQuery, stats } from '../lib/kg.mjs';
import { EMBEDS, baseFiles, guide, obsidianFiles } from './kg-solo-ui.mjs';

export const name = 'kg-solo';
export const description = 'Knowledge-graph vault of a solo consultant: typed edges, claims over time, causal loops, planted errors, answer key.';
export const options = {
  seed: { default: 11, description: 'PRNG seed (procedural clients and daily notes)' },
  clients: { default: 30, description: 'procedural clients on top of the core story (about 13 notes each)' },
  days: { default: 365, description: 'days of daily notes ending at 2026-10-15 (about 60% of days get a note)' },
  answers: { default: '.kg-answers.json', description: 'dot file with the schema and the answer key (JSON)' },
  ui: { default: false, description: 'also write UI config: .obsidian plugin settings (Bases, Breadcrumbs, ExcaliBrain), .base files, embedded views in client/project/factor pages, and a hands-on guide' },
};

export const TODAY = '2026-10-15';

const F = ['factor'];
export const schema = {
  version: '2+kg-solo.1',
  note: 'Schema v2 of obsidian-pkm-automation plus business types and edges (organization, contract, meeting, decision, document), validity windows and superseded_by, fact claims (works_at, contact_for). A candidate for schema v3 (E9.1), not the decision.',
  enums: {
    confidence: ['speculative', 'plausible', 'established'],
    evidence_type: ['anecdote', 'observational', 'experimental', 'textual', 'expert'],
    claimStatus: ['proposed', 'accepted', 'rejected', 'superseded'],
    proposedBy: ['llm', 'human'],
  },
  types: {
    concept: {}, factor: {}, claim: {}, person: {}, organization: {}, project: {}, contract: {}, meeting: {},
    decision: {}, document: {}, tool: {}, moc: {}, note: {},
    source: { fields: { author: { linkTo: ['person'] } } },
  },
  edges: {
    up: { inverse: 'down', domain: ['concept'], range: ['concept'] },
    parent_moc: { inverse: 'child_moc', domain: ['moc'], range: ['moc'] },
    part_of: { inverse: 'has_part', domain: ['*'], range: ['same'] },
    next: { inverse: 'prev', domain: ['*'], range: ['*'] },
    related: { inverse: 'related', symmetric: true, domain: ['*'], range: ['*'], excludesWith: ['up'] },
    uses: { inverse: 'used_by', domain: ['project', 'tool'], range: ['tool', 'concept'] },
    source: { inverse: 'cited_by', domain: ['*'], range: ['source', 'meeting', 'document', 'contract'] },
    supports: { inverse: 'supported_by', domain: ['source', 'claim', 'meeting', 'document'], range: ['claim'] },
    disputes: { inverse: 'disputed_by', domain: ['source', 'claim', 'meeting', 'document'], range: ['claim'] },
    client: { inverse: 'has_project', domain: ['project'], range: ['organization'] },
    party: { inverse: 'has_contract', domain: ['contract'], range: ['organization'] },
    covers: { inverse: 'covered_by', domain: ['contract'], range: ['project'] },
    decided_in: { inverse: 'decision', domain: ['decision'], range: ['meeting'] },
    affects: { inverse: 'affected_by', domain: ['decision'], range: ['project', 'contract', 'document'] },
    superseded_by: { inverse: 'supersedes', domain: ['claim', 'contract', 'decision', 'document'], range: ['same'] },
    correlates_with: { inverse: 'correlates_with', symmetric: true, domain: F, range: F, rung: 1 },
    increases: { inverse: 'increased_by', domain: F, range: F, rung: 2, polarity: '+' },
    decreases: { inverse: 'decreased_by', domain: F, range: F, rung: 2, polarity: '-' },
    conditions: { inverse: 'conditioned_by', domain: F, range: F, rung: 3, humanOnly: true },
    prevents: { inverse: 'prevented_by', domain: F, range: F, rung: 2, polarity: '-' },
  },
  facts: {
    works_at: { inverse: 'employs', domain: ['person'], range: ['organization'] },
    contact_for: { inverse: 'contact', domain: ['person'], range: ['organization'] },
  },
  claimRelations: { correlates_with: 'causal', increases: 'causal', decreases: 'causal', conditions: 'causal', prevents: 'causal', works_at: 'fact', contact_for: 'fact' },
  claimFields: {
    relation: {}, cause: { linkTo: F }, effect: { linkTo: F }, subject: { linkTo: ['person'] }, object: { linkTo: ['organization'] },
    confidence: { enum: 'confidence' }, evidence_type: { enum: 'evidence_type' }, status: { enum: 'claimStatus' }, proposed_by: { enum: 'proposedBy' },
    counterfactual: {}, mechanism: {}, scope: {}, valid_from: {}, valid_to: {},
  },
  claimRequired: ['relation', 'confidence', 'source', 'status'],
  claimRequiredIf: { conditions: ['counterfactual'] },
  rules: {
    R1: 'every note has exactly one known type',
    R2: 'every frontmatter key that holds links is an edge key or a field',
    R3: 'every edge or field target resolves (title, then alias)',
    R4: 'source and target types fit the edge (or claim field) domain and range',
    R5: 'inverse keys are never written',
    R6: 'no pair has both related and up',
    R7: 'no edge points to its own note',
    R8: 'titles and aliases are unique, case- and diacritic-insensitive',
    R9: 'claims have their required fields and valid enum values',
    R10: 'a conditions claim by an LLM stays proposed',
  },
};

// --- rendering -------------------------------------------------------------------------------------------

const L = (t, frag = '') => `[[${t}${frag}]]`;
const SAFE = /^[\p{L}\p{N} ,.()_/'-]+$/u;
const scalar = (v) => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : /^\d{4}-\d{2}-\d{2}$/.test(v) || (SAFE.test(v) && !/^[-?'\s]|\s$/.test(v)) ? v : JSON.stringify(v));
const renderFm = (fm) => '---\n' + Object.entries(fm).map(([k, v]) => (Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${scalar(x)}`).join('\n')}` : `${k}: ${scalar(v)}`)).join('\n') + '\n---\n';

const day0 = Date.UTC(2018, 0, 1);
const iso = (d) => new Date(day0 + d * 864e5).toISOString().slice(0, 10);
const dayOf = (s) => Math.round((Date.parse(s + 'T00:00:00Z') - day0) / 864e5);

export function build({ seed = 11, clients = 30, days = 365, answers = options.answers.default, ui = false } = {}) {
  const { rand, pick, some, chance } = createRng(seed);
  const notes = new Map(); // path -> {fm, body}
  const titleTo = new Map(); // title -> path
  const taken = new Set(); // normalised titles and aliases in use
  const add = (folder, title, fm, body = '') => {
    const p = `${folder}/${title}.md`;
    notes.set(p, { fm, body });
    titleTo.set(title, p);
    taken.add(norm(title));
    for (const a of fm.aliases || []) taken.add(norm(a));
    return p;
  };
  const fmOf = (title) => notes.get(titleTo.get(title)).fm;
  const push = (title, key, value) => { const fm = fmOf(title); (fm[key] ||= []).push(value); };

  // --- core story: hand-designed, the same at every seed and size ---------------------------------------
  const sentenceBits = ['khách cần bản tóm tắt ngắn', 'phạm vi việc đã chốt', 'tiến độ chậm một tuần', 'cần thêm dữ liệu gốc', 'đã gửi báo giá', 'khách góp ý về giao diện', 'chờ khách phản hồi', 'đã bàn giao bản nháp'];

  add('MOC', 'MOC Kinh doanh', { type: 'moc' }, `# MOC Kinh doanh\n\nĐiểm vào cho việc kinh doanh một người: ${L('MOC Khách hàng')}, ${L('MOC Dự án')}.\n\n## Vòng kinh doanh\n- ${L('Doanh thu định kỳ')}, ${L('Số dự án song song')}, ${L('Mức kiệt sức')}\n- ${L('Chân dung khách hàng')}\n`);
  add('MOC', 'MOC Khách hàng', { type: 'moc', parent_moc: [L('MOC Kinh doanh')] }, `# MOC Khách hàng\n\n- ${L('Công ty ABC')}\n- ${L('Cửa hàng Mộc')}\n- ${L('Startup Lá Xanh')}\n`);
  add('MOC', 'MOC Dự án', { type: 'moc', parent_moc: [L('MOC Kinh doanh')] }, `# MOC Dự án\n\n- ${L('Website ABC 2025')}\n- ${L('Dashboard doanh thu ABC')}\n- ${L('Chiến dịch Tết Mộc')}\n- ${L('MVP Lá Xanh')}\n`);
  add('MOC', 'MOC Dashboard ABC', { type: 'moc', parent_moc: [L('MOC Dự án')] }, `# MOC Dashboard ABC\n\nNằm trong MOC này không có nghĩa là hẹp hơn nó: ${L('Báo cáo tuần')} thuộc khái niệm ${L('Dashboard')}.\n\n- ${L('Dashboard doanh thu ABC')}\n- ${L('Báo cáo tuần')}\n- ${L('Chuyển dashboard sang Metabase')}\n`);

  add('Khái niệm', 'Phân tích dữ liệu', { type: 'concept' }, '# Phân tích dữ liệu\n');
  add('Khái niệm', 'Dashboard', { type: 'concept', up: [L('Phân tích dữ liệu')], related: [L('Phân tích dữ liệu')] }, '# Dashboard\n\nLỗi cài sẵn R6: vừa up vừa related với cùng một note.\n');
  add('Khái niệm', 'Báo cáo tuần', { type: 'concept', up: [L('Dashboard')] }, `# Báo cáo tuần\n\nĐọc cùng ${L('MOC Dashboard ABC')}.\n`);
  add('Khái niệm', 'Marketing số', { type: 'concept', related: [L('Marketing số')] }, '# Marketing số\n\nLỗi cài sẵn R7: related trỏ về chính nó.\n');
  add('Khái niệm', 'Chân dung khách hàng', { type: 'concept', up: [L('MOC Kinh doanh')] }, '# Chân dung khách hàng\n\nLỗi cài sẵn R4: up trỏ tới một MOC (điều hướng không phải phân loại).\n');
  add('Khái niệm', 'Bán hàng tư vấn', { type: 'concept', related: [L('Chân dung khách hàng')] }, '# Bán hàng tư vấn\n');
  add('Khái niệm', 'Cà phê', { type: 'concept', increases: [L('Mức kiệt sức')] }, '# Cà phê\n\nLỗi cài sẵn R4: một đồ vật (concept) không được làm nguyên nhân; nguyên nhân phải là factor ("Lượng caffeine buổi tối").\n');

  add('Công cụ', 'Webflow', { type: 'tool', related: [L('Supabase')] }, '# Webflow\n');
  add('Công cụ', 'Metabase', { type: 'tool', used_by: [L('Dashboard doanh thu ABC')] }, '# Metabase\n\nLỗi cài sẵn R5: khoá ngược used_by được ghi tay.\n');
  add('Công cụ', 'Google Sheets', { type: 'tool' }, '# Google Sheets\n');
  add('Công cụ', 'Supabase', { type: 'tool' }, '# Supabase\n');
  add('Công cụ', 'Canva', { type: 'tool' }, '# Canva\n');
  add('Công cụ', 'Notion', { type: 'tool', uses: [L('Phân tích dữ liệu')] }, '# Notion\n');

  add('Khách hàng', 'Công ty ABC', { type: 'organization', aliases: ['ABC Corp', 'ABC'], tags: ['khách-hàng'] }, `# Công ty ABC\n\nKhách hàng lâu năm nhất. Đầu mối đổi từ ${L('Nguyễn Văn An')} sang ${L('Trần Thị Bình')} tháng 4/2026.\n`);
  add('Khách hàng', 'Cửa hàng Mộc', { type: 'organization', aliases: ['Mộc Store'], tags: ['khách-hàng'] }, `# Cửa hàng Mộc\n\nChủ là ${L('Lê Minh Châu')}.\n`);
  add('Khách hàng', 'Startup Lá Xanh', { type: 'organization', aliases: ['Lá Xanh'], tags: ['khách-hàng'] }, `# Startup Lá Xanh\n\nLàm theo thoả thuận qua email, chưa có hợp đồng.\n`);

  for (const p of ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Minh Châu', 'Phạm Quốc Dũng', 'Hoàng Thu Hà']) add('Người', p, { type: 'person' }, `# ${p}\n`);

  add('Dự án', 'Website ABC 2025', { type: 'project', client: [L('Công ty ABC')], uses: [L('Webflow'), L('Marketing số')], status: 'done', start: '2025-02-01' }, `# Website ABC 2025\n\nLàm với ${L('Hoàng Thu Hà')} (thiết kế).\n`);
  add('Dự án', 'Dashboard doanh thu ABC', { type: 'project', client: [L('ABC Corp')], uses: [L('Metabase'), L('Google Sheets'), L('Phân tích dữ liệu')], status: 'active', start: '2026-01-10' }, `# Dashboard doanh thu ABC\n\nKhách hàng ghi bằng alias ${L('ABC Corp')}: Obsidian không nối alias, graph phải nối.\n`);
  add('Dự án', 'Chiến dịch Tết Mộc', { type: 'project', client: [L('Cửa hàng Mộc')], uses: [L('Canva'), L('Figma')], status: 'done', start: '2025-11-20' }, '# Chiến dịch Tết Mộc\n\nLỗi cài sẵn R3: Figma chưa có note.\n');
  add('Dự án', 'Landing page Tết Mộc', { type: 'project', part_of: [L('Chiến dịch Tết Mộc')], client: [L('Mộc Store')], uses: [L('Webflow')], status: 'done', start: '2025-12-01' }, '# Landing page Tết Mộc\n');
  add('Dự án', 'MVP Lá Xanh', { type: 'project', client: [L('Startup Lá Xanh')], uses: [L('Supabase'), L('Webflow')], status: 'active', start: '2025-08-01' }, `# MVP Lá Xanh\n\nĐầu mối ${L('Nguyễn Văn Ân')}, CTO ${L('Phạm Quốc Dũng')}.\n`);

  add('Hợp đồng', 'HĐ ABC 2025', { type: 'contract', party: [L('Công ty ABC')], covers: [L('Website ABC 2025')], valid_from: '2025-01-01', valid_to: '2025-12-31', value: 120000000, superseded_by: [L('HĐ ABC 2026')] }, '# HĐ ABC 2025\n\nTrọn gói, giá cố định.\n');
  add('Hợp đồng', 'HĐ ABC 2026', { type: 'contract', party: [L('Công ty ABC')], covers: [L('Dashboard doanh thu ABC')], valid_from: '2026-01-01', valid_to: '2026-12-31', value: 180000000 }, '# HĐ ABC 2026\n\nTính theo giờ, trần 180 triệu.\n');
  add('Hợp đồng', 'HĐ Mộc Tết 2026', { type: 'contract', party: [L('Cửa hàng Mộc')], covers: [L('Chiến dịch Tết Mộc'), L('Landing page Tết Mộc')], valid_from: '2025-11-15', valid_to: '2026-02-28', value: 45000000 }, '# HĐ Mộc Tết 2026\n');

  add('Tài liệu', 'Bảng giá 2025', { type: 'document', valid_from: '2025-01-01', valid_to: '2025-12-31', superseded_by: [L('Bảng giá 2026')] }, '# Bảng giá 2025\n\n| Gói | Giá |\n|---|---|\n| Website | 120 triệu |\n| Dashboard | 90 triệu |\n');
  add('Tài liệu', 'Bảng giá 2026', { type: 'document', valid_from: '2026-01-01' }, '# Bảng giá 2026\n\n| Gói | Giá |\n|---|---|\n| Theo giờ | 1,2 triệu/giờ |\n');

  add('Họp', 'Họp nội bộ 2025-03-01', { type: 'meeting', date: '2025-03-01' }, '# Họp nội bộ 2025-03-01\n\n- Nhận dự án trọn gói giá cố định để dễ bán. ^fixed\n');
  add('Họp', 'Họp nội bộ 2026-01-05', { type: 'meeting', date: '2026-01-05' }, '# Họp nội bộ 2026-01-05\n\nNhìn lại năm 2025.\n\n- Nhận quá ba dự án song song thì chất lượng bàn giao giảm rõ. ^q1\n- Tuần nào ngủ dưới sáu tiếng thì trả lời khách chậm hẳn. ^q2\n- Từ 2026 chỉ nhận dự án tính theo giờ. ^hourly\n');
  add('Họp', 'Họp ABC 2026-02-10', { type: 'meeting', date: '2026-02-10' }, `# Họp ABC 2026-02-10\n\nCó ${L('Nguyễn Văn An')}, phía ${L('ABC Corp')}.\n\n- Khách chỉ cấp quyền truy cập dữ liệu khi hợp đồng còn hiệu lực. ^q1\n- Báo cáo tuần bắt đầu từ tháng 1/2026 và cần dữ liệu từ hệ thống của khách. ^q2\n- Chuyển dashboard từ Google Sheets sang Metabase. ^q3\n`);
  add('Họp', 'Họp ABC 2026-03-20', { type: 'meeting', date: '2026-03-20' }, `# Họp ABC 2026-03-20\n\n- ${L('Nguyễn Văn An')} bàn giao vai trò đầu mối cho ${L('Trần Thị Bình')} từ 2026-04-01. ^handover\n`);
  add('Họp', 'Họp Mộc 2025-09-05', { type: 'meeting', date: '2025-09-05' }, `# Họp Mộc 2025-09-05\n\n- ${L('Lê Minh Châu')} đồng ý thanh toán trước 50%; từ khi áp dụng không còn hoá đơn quá hạn. ^tt50\n`);

  add('Quyết định', 'Nhận dự án giá cố định', { type: 'decision', decided_in: [L('Họp nội bộ 2025-03-01')], valid_from: '2025-03-01', valid_to: '2025-12-31', superseded_by: [L('Chỉ nhận dự án tính theo giờ')] }, '# Nhận dự án giá cố định\n');
  add('Quyết định', 'Chỉ nhận dự án tính theo giờ', { type: 'decision', decided_in: [L('Họp nội bộ 2026-01-05')], affects: [L('HĐ ABC 2026'), L('Bảng giá 2026')], valid_from: '2026-01-01' }, '# Chỉ nhận dự án tính theo giờ\n\nĐảo quyết định giá cố định của năm 2025.\n');
  add('Quyết định', 'Chuyển dashboard sang Metabase', { type: 'decision', decided_in: [L('Họp ABC 2026-02-10')], affects: [L('Dashboard doanh thu ABC')], valid_from: '2026-02-10' }, '# Chuyển dashboard sang Metabase\n');

  add('Nguồn', 'Sách Bán hàng tư vấn', { type: 'source', year: 2019, supports: [L('Giảm giá giữ chân khách cũ')] }, '# Sách Bán hàng tư vấn\n');
  add('Nguồn', 'Báo cáo khảo sát khách 2026', { type: 'source', year: 2026, disputes: [L('Giảm giá giữ chân khách cũ')] }, '# Báo cáo khảo sát khách 2026\n\nKhách cũ gia hạn vì chất lượng, không vì giảm giá. ^k1\n');
  add('Nguồn', 'Nghiên cứu giấc ngủ và kiệt sức', { type: 'source', year: 2024 }, '# Nghiên cứu giấc ngủ và kiệt sức\n');

  const factors = ['Doanh thu định kỳ', 'Ngân sách marketing', 'Số lead mới', 'Số dự án song song', 'Khối lượng việc', 'Chất lượng bàn giao', 'Mức hài lòng khách hàng', 'Tỷ lệ gia hạn hợp đồng', 'Giờ ngủ', 'Mức kiệt sức', 'Thời gian phản hồi khách', 'Thanh toán trước 50%', 'Nợ quá hạn', 'Dòng tiền', 'Số bài đăng LinkedIn', 'Mức giảm giá cho khách cũ', 'Hợp đồng ABC còn hiệu lực', 'Quyền truy cập dữ liệu ABC', 'Khả năng cập nhật dashboard ABC', 'Doanh thu dự án dashboard ABC', 'Báo cáo tuần cho ABC'];
  for (const f of factors) add('Yếu tố', f, { type: 'factor' }, `# ${f}\n`);
  // Causal links written straight on the cause note.
  for (const [a, rel, b] of [
    ['Doanh thu định kỳ', 'increases', 'Ngân sách marketing'], ['Ngân sách marketing', 'increases', 'Số lead mới'], ['Số lead mới', 'increases', 'Số dự án song song'],
    ['Số dự án song song', 'increases', 'Doanh thu định kỳ'], ['Số dự án song song', 'increases', 'Khối lượng việc'], ['Chất lượng bàn giao', 'increases', 'Mức hài lòng khách hàng'],
    ['Mức hài lòng khách hàng', 'increases', 'Tỷ lệ gia hạn hợp đồng'], ['Tỷ lệ gia hạn hợp đồng', 'increases', 'Số dự án song song'], ['Mức kiệt sức', 'increases', 'Thời gian phản hồi khách'],
    ['Dòng tiền', 'increases', 'Ngân sách marketing'], ['Nợ quá hạn', 'decreases', 'Dòng tiền'],
  ]) push(a, rel, L(b));
  fmOf('Số bài đăng LinkedIn').proposed_by = 'llm';
  fmOf('Số bài đăng LinkedIn')['dẫn_đến'] = [L('Số lead mới')]; // R2: drifted label from an LLM

  // Causal and fact claims: one note per edge, with status, confidence and sources.
  const claim = (title, fm, body = '') => add('Claim', title, { type: 'claim', ...fm }, `# ${title}\n${body}`);
  claim('Nhiều việc làm giảm chất lượng bàn giao', { relation: 'decreases', cause: L('Khối lượng việc'), effect: L('Chất lượng bàn giao'), confidence: 'plausible', evidence_type: 'anecdote', source: [L('Họp nội bộ 2026-01-05', '#^q1')], status: 'accepted' });
  claim('Nhiều việc làm giảm giờ ngủ', { relation: 'decreases', cause: L('Khối lượng việc'), effect: L('Giờ ngủ'), confidence: 'plausible', evidence_type: 'anecdote', source: [L('Họp nội bộ 2026-01-05', '#^q2')], status: 'accepted' });
  claim('Ngủ đủ giảm kiệt sức', { relation: 'decreases', cause: L('Giờ ngủ'), effect: L('Mức kiệt sức'), confidence: 'established', evidence_type: 'experimental', source: [L('Nghiên cứu giấc ngủ và kiệt sức')], status: 'accepted' });
  claim('Phản hồi chậm làm giảm hài lòng', { relation: 'decreases', cause: L('Thời gian phản hồi khách'), effect: L('Mức hài lòng khách hàng'), confidence: 'plausible', evidence_type: 'anecdote', source: [L('Họp nội bộ 2026-01-05', '#^q2')], status: 'accepted' });
  claim('Thanh toán trước chặn nợ quá hạn', { relation: 'prevents', cause: L('Thanh toán trước 50%'), effect: L('Nợ quá hạn'), confidence: 'plausible', evidence_type: 'observational', source: [L('Họp Mộc 2025-09-05', '#^tt50')], status: 'accepted', scope: 'khách hàng nhỏ, dự án dưới 50 triệu' });
  claim('Bài đăng LinkedIn đi cùng lead', { relation: 'correlates_with', cause: L('Số bài đăng LinkedIn'), effect: L('Số lead mới'), confidence: 'plausible', evidence_type: 'observational', source: [L('Họp nội bộ 2026-01-05')], status: 'accepted' });
  claim('LinkedIn là điều kiện có lead', { relation: 'conditions', cause: L('Số bài đăng LinkedIn'), effect: L('Số lead mới'), confidence: 'speculative', source: [L('Họp nội bộ 2026-01-05')], status: 'proposed', proposed_by: 'llm', counterfactual: 'Không đăng bài thì không có lead mới.' }, '\nLLM đề xuất nâng tương quan thành điều kiện; đang chờ duyệt.\n');
  claim('Giảm giá giữ chân khách cũ', { relation: 'increases', cause: L('Mức giảm giá cho khách cũ'), effect: L('Tỷ lệ gia hạn hợp đồng'), confidence: 'speculative', source: [L('Sách Bán hàng tư vấn')], status: 'proposed' }, `\nBị ${L('Báo cáo khảo sát khách 2026')} phản bác.\n`);
  claim('Phản hồi nhanh là điều kiện gia hạn', { relation: 'conditions', cause: L('Thời gian phản hồi khách'), effect: L('Tỷ lệ gia hạn hợp đồng'), confidence: 'speculative', source: [L('Họp nội bộ 2026-01-05')], status: 'accepted', proposed_by: 'llm', counterfactual: 'Phản hồi chậm thì không gia hạn.' }, '\nLỗi cài sẵn R10: LLM ghi conditions và tự đặt accepted.\n');
  claim('Nhiều việc làm chậm phản hồi', { relation: 'increases', cause: L('Khối lượng việc'), effect: L('Thời gian phản hồi khách'), source: [L('Họp nội bộ 2026-01-05')], status: 'proposed', proposed_by: 'llm' }, '\nLỗi cài sẵn R9: thiếu confidence.\n');
  claim('Ngân sách là điều kiện có lead', { relation: 'conditions', cause: L('Ngân sách marketing'), effect: L('Số lead mới'), confidence: 'speculative', source: [L('Họp nội bộ 2026-01-05')], status: 'proposed' }, '\nLỗi cài sẵn R9: conditions thiếu counterfactual.\n');
  for (const [title, a, b, extra] of [
    ['Hợp đồng là điều kiện truy cập dữ liệu', 'Hợp đồng ABC còn hiệu lực', 'Quyền truy cập dữ liệu ABC', { source: [L('Họp ABC 2026-02-10', '#^q1')], counterfactual: 'Hợp đồng hết hiệu lực thì khách khoá quyền truy cập.' }],
    ['Truy cập dữ liệu là điều kiện cập nhật dashboard', 'Quyền truy cập dữ liệu ABC', 'Khả năng cập nhật dashboard ABC', { source: [L('Họp ABC 2026-02-10', '#^q1')], counterfactual: 'Không có dữ liệu thì không cập nhật được.' }],
    ['Cập nhật dashboard là điều kiện thu tiền dự án', 'Khả năng cập nhật dashboard ABC', 'Doanh thu dự án dashboard ABC', { source: [L('HĐ ABC 2026')], counterfactual: 'Hợp đồng tính theo giờ cập nhật; không cập nhật thì không có giờ để thu.' }],
    ['Truy cập dữ liệu là điều kiện báo cáo tuần', 'Quyền truy cập dữ liệu ABC', 'Báo cáo tuần cho ABC', { source: [L('Họp ABC 2026-02-10', '#^q2')], counterfactual: 'Không có dữ liệu thì không có báo cáo tuần.', valid_from: '2026-01-01' }],
  ]) claim(title, { relation: 'conditions', cause: L(a), effect: L(b), confidence: 'established', evidence_type: 'textual', status: 'accepted', ...extra });
  claim('Đầu mối ABC - Nguyễn Văn An', { relation: 'contact_for', subject: L('Nguyễn Văn An'), object: L('Công ty ABC'), confidence: 'established', source: [L('Họp ABC 2026-03-20', '#^handover')], status: 'superseded', valid_from: '2024-06-01', valid_to: '2026-03-31', superseded_by: [L('Đầu mối ABC - Trần Thị Bình')] });
  claim('Đầu mối ABC - Trần Thị Bình', { relation: 'contact_for', subject: L('Trần Thị Bình'), object: L('Công ty ABC'), confidence: 'established', source: [L('Họp ABC 2026-03-20', '#^handover')], status: 'accepted', valid_from: '2026-04-01' });
  claim('Đầu mối Mộc - Lê Minh Châu', { relation: 'contact_for', subject: L('Lê Minh Châu'), object: L('Cửa hàng Mộc'), confidence: 'established', source: [L('Họp Mộc 2025-09-05')], status: 'accepted', valid_from: '2025-09-01' });
  claim('Nguyễn Văn An làm ở ABC', { relation: 'works_at', subject: L('Nguyễn Văn An'), object: L('Công ty ABC'), confidence: 'established', source: [L('Họp ABC 2026-02-10')], status: 'accepted', valid_from: '2019-01-01' });
  claim('Trần Thị Bình làm ở ABC', { relation: 'works_at', subject: L('Trần Thị Bình'), object: L('Công ty ABC'), confidence: 'established', source: [L('Họp ABC 2026-03-20')], status: 'accepted', valid_from: '2026-03-01' });
  claim('Phạm Quốc Dũng làm ở ABC', { relation: 'works_at', subject: L('Phạm Quốc Dũng'), object: L('Công ty ABC'), confidence: 'established', source: [L('Họp ABC 2026-02-10')], status: 'superseded', valid_from: '2021-02-01', valid_to: '2025-06-30', superseded_by: [L('Phạm Quốc Dũng làm ở Lá Xanh')] });
  claim('Phạm Quốc Dũng làm ở Lá Xanh', { relation: 'works_at', subject: L('Phạm Quốc Dũng'), object: L('Startup Lá Xanh'), confidence: 'established', source: [L('Họp nội bộ 2026-01-05')], status: 'accepted', valid_from: '2025-07-01' });
  claim('Lê Minh Châu làm ở Mộc', { relation: 'works_at', subject: L('Lê Minh Châu'), object: L('Cửa hàng Mộc'), confidence: 'established', source: [L('Họp Mộc 2025-09-05')], status: 'accepted', valid_from: '2020-01-01' });

  // Planted R8 collisions, added after the core names so the procedural part never reuses them:
  // a duplicate the LLM created (same client, should merge) and a different person (should not merge).
  add('Khách hàng', 'Cua hang Moc', { type: 'organization', proposed_by: 'llm' }, `# Cua hang Moc\n\nTạo từ email của ${L('Lê Minh Châu')}; trùng ${L('Cửa hàng Mộc')}.\n`);
  add('Người', 'Nguyễn Văn Ân', { type: 'person' }, `# Nguyễn Văn Ân\n\nNhà sáng lập ${L('Lá Xanh')}. Khác người với ${L('Nguyễn Văn An')} (ABC).\n`);
  claim('Đầu mối Lá Xanh - Nguyễn Văn Ân', { relation: 'contact_for', subject: L('Nguyễn Văn Ân'), object: L('Startup Lá Xanh'), confidence: 'established', source: [L('Họp nội bộ 2026-01-05')], status: 'accepted', valid_from: '2025-07-15' });
  claim('Nguyễn Văn Ân làm ở Lá Xanh', { relation: 'works_at', subject: L('Nguyễn Văn Ân'), object: L('Startup Lá Xanh'), confidence: 'established', source: [L('Họp nội bộ 2026-01-05')], status: 'accepted', valid_from: '2025-01-01' });

  // --- procedural clients -------------------------------------------------------------------------------
  const prefixes = ['Công ty', 'Cửa hàng', 'Nhà hàng', 'Phòng khám', 'Trung tâm', 'Xưởng', 'Studio', 'Quán'];
  const brands = ['Sao Mai', 'Hoa Sen', 'Bình Minh', 'Phú Thịnh', 'Hướng Dương', 'Biển Xanh', 'Mùa Thu', 'Trúc Lâm', 'An Khang', 'Kim Ngân', 'Tân Phát', 'Đại Việt', 'Thành Công', 'Hồng Phúc', 'Minh Long', 'Ngọc Lan', 'Thiên Ân', 'Hải Đăng', 'Phương Nam', 'Cát Tường', 'Vạn Xuân', 'Gia Bảo', 'Thảo Nguyên', 'Đông Á', 'Hòa Bình', 'Lam Sơn', 'Bảo Tín', 'Song Hành', 'Nhật Quang', 'Tràng An', 'Hương Giang', 'Bạch Mai', 'Trường Sơn', 'Việt Mỹ', 'Kim Long', 'Hà Thành', 'Sài Gòn Xanh', 'Mekong', 'Tây Nguyên', 'Phố Hội'];
  const family = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý', 'Võ', 'Phan'];
  const middle = ['Văn', 'Thị', 'Minh', 'Quốc', 'Thu', 'Hữu', 'Ngọc', 'Thanh', 'Đức', 'Hoài'];
  const given = ['Anh', 'Bảo', 'Cường', 'Diệp', 'Giang', 'Hạnh', 'Hiếu', 'Hưng', 'Khoa', 'Khôi', 'Lâm', 'Loan', 'Lộc', 'Mạnh', 'My', 'Nga', 'Nhân', 'Nhung', 'Oanh', 'Phong', 'Phương', 'Quang', 'Quyên', 'Sang', 'Tâm', 'Tân', 'Thắng', 'Thịnh', 'Thơ', 'Thuỷ', 'Tiến', 'Toàn', 'Trí', 'Trinh', 'Trung', 'Tú', 'Uyên', 'Vân', 'Việt', 'Xuân'];
  const tools = ['Webflow', 'Metabase', 'Google Sheets', 'Supabase', 'Canva', 'Notion', 'WordPress', 'Shopify', 'Looker Studio', 'Airtable', 'Zapier', 'HubSpot', 'Figma Community', 'Power BI', 'n8n'];
  for (const t of tools) if (!titleTo.has(t)) add('Công cụ', t, { type: 'tool' }, `# ${t}\n`);
  const projectTools = tools.filter((t) => t !== 'Metabase'); // keeps the core case "which projects use Metabase" fixed
  const kinds = ['Website', 'Dashboard', 'Chiến dịch', 'App', 'Báo cáo', 'Kho dữ liệu', 'Khoá đào tạo', 'CRM'];
  const fresh = (make) => { for (let k = 0; ; k++) { const t = make(k); if (!taken.has(norm(t))) return t; } };
  const person = () => fresh((k) => `${pick(family)} ${pick(middle)} ${pick(given)}${k > 20 ? ' ' + k : ''}`);
  const span = (from, to) => from + Math.floor(rand() * (to - from));
  const orgs = [];

  for (let i = 0; i < clients; i++) {
    const brand = brands[i % brands.length] + (i >= brands.length * prefixes.length ? ` ${Math.floor(i / (brands.length * prefixes.length)) + 1}` : '');
    const org = fresh((k) => `${prefixes[(i + Math.floor(i / brands.length)) % prefixes.length]} ${brand}${k ? ' ' + (k + 1) : ''}`);
    const short = taken.has(norm(brand)) ? org : brand;
    const orgFm = { type: 'organization', tags: ['khách-hàng'] };
    if (short !== org) orgFm.aliases = [short];
    add('Khách hàng', org, orgFm, `# ${org}\n\n${some(sentenceBits, 2).join('. ')}.\n`);
    orgs.push(org);

    const meetings = [];
    for (let m = 0, n = 1 + Math.floor(rand() * 3); m < n; m++) {
      const date = iso(span(dayOf('2024-03-01'), dayOf('2026-10-01')));
      const t = fresh((k) => `Họp ${short} ${date}${k ? ' ' + (k + 1) : ''}`);
      add('Họp', t, { type: 'meeting', date }, `# ${t}\n\n- ${pick(sentenceBits)}. ^b1\n- ${pick(sentenceBits)}. ^b2\n`);
      meetings.push(t);
    }
    meetings.sort();
    const cite = () => [L(pick(meetings), pick(['#^b1', '#^b2']))];

    const staff = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => { const p = person(); add('Người', p, { type: 'person' }, `# ${p}\n`); return p; });
    for (const p of staff) {
      const from = span(dayOf('2018-01-01'), dayOf('2024-01-01'));
      const left = chance(0.2) ? span(from + 200, dayOf('2026-09-01')) : null;
      claim(`${p} làm ở ${short}`, { relation: 'works_at', subject: L(p), object: L(org), confidence: 'established', source: cite(), status: 'accepted', valid_from: iso(from), ...(left !== null ? { valid_to: iso(left) } : {}) });
    }
    const c1 = staff[0], switchAt = staff.length > 1 && chance(0.5) ? span(dayOf('2025-01-01'), dayOf('2026-09-01')) : null;
    if (switchAt !== null) {
      claim(`Đầu mối ${short} - ${c1}`, { relation: 'contact_for', subject: L(c1), object: L(org), confidence: 'established', source: cite(), status: 'superseded', valid_from: '2024-01-01', valid_to: iso(switchAt - 1), superseded_by: [L(`Đầu mối ${short} - ${staff[1]}`)] });
      claim(`Đầu mối ${short} - ${staff[1]}`, { relation: 'contact_for', subject: L(staff[1]), object: L(org), confidence: 'established', source: cite(), status: 'accepted', valid_from: iso(switchAt) });
    } else {
      claim(`Đầu mối ${short} - ${c1}`, { relation: 'contact_for', subject: L(c1), object: L(org), confidence: 'established', source: cite(), status: 'accepted', valid_from: '2024-01-01' });
    }

    const projects = [];
    for (let m = 0, n = 1 + Math.floor(rand() * 3); m < n; m++) {
      const t = fresh((k) => `${kinds[(i + m) % kinds.length]} ${short}${k ? ' ' + (k + 1) : ''}`);
      const clientLink = orgFm.aliases && chance(0.2) ? L(short) : L(org);
      add('Dự án', t, { type: 'project', client: [clientLink], uses: [...new Set(some(projectTools, 1 + Math.floor(rand() * 3)))].map((x) => L(x)), status: pick(['active', 'done', 'paused']), start: iso(span(dayOf('2024-01-01'), dayOf('2026-09-01'))) }, `# ${t}\n\n${pick(sentenceBits)}.\n`);
      projects.push(t);
    }
    if (chance(0.7)) {
      const y = 2024 + Math.floor(rand() * 2);
      const first = `HĐ ${short} ${y}`;
      const renew = chance(0.5) ? `HĐ ${short} ${y + 1}` : null;
      add('Hợp đồng', first, { type: 'contract', party: [L(org)], covers: [L(projects[0])], valid_from: `${y}-01-01`, valid_to: `${y}-12-31`, value: (20 + Math.floor(rand() * 200)) * 1000000, ...(renew ? { superseded_by: [L(renew)] } : {}) }, `# ${first}\n`);
      if (renew) add('Hợp đồng', renew, { type: 'contract', party: [L(org)], covers: [L(projects[projects.length - 1])], valid_from: `${y + 1}-01-01`, valid_to: `${y + 1}-12-31`, value: (20 + Math.floor(rand() * 200)) * 1000000 }, `# ${renew}\n`);
    }
    if (chance(0.5)) {
      const t = fresh((k) => `${pick(['Chốt phạm vi', 'Đổi công cụ cho', 'Tạm dừng', 'Mở rộng'])} ${projects[0]}${k ? ' ' + (k + 1) : ''}`);
      const mt = meetings[0];
      add('Quyết định', t, { type: 'decision', decided_in: [L(mt)], affects: [L(projects[0])], date: fmOf(mt).date }, `# ${t}\n`);
    }
    // Two factors per client, wired into the core causal model: more loops at larger sizes.
    const hl = `Mức hài lòng của ${short}`, dt = `Doanh thu từ ${short}`;
    add('Yếu tố', hl, { type: 'factor', increases: [L(dt)] }, `# ${hl}\n`);
    add('Yếu tố', dt, { type: 'factor', increases: [L('Doanh thu định kỳ')] }, `# ${dt}\n`);
    if (i % 2) claim(`Chất lượng bàn giao tăng hài lòng của ${short}`, { relation: 'increases', cause: L('Chất lượng bàn giao'), effect: L(hl), confidence: 'plausible', source: cite(), status: 'accepted' });
    else push('Chất lượng bàn giao', 'increases', L(hl));
    push('Thời gian phản hồi khách', 'decreases', L(hl));
  }

  // --- daily notes: untyped mentions, some through aliases ----------------------------------------------
  const mentionable = [...titleTo.keys()].filter((t) => /^(Khách hàng|Dự án|Người|Họp)\//.test(titleTo.get(t)));
  const aliasNames = ['ABC Corp', 'Mộc Store', 'Lá Xanh'];
  for (let d = 0; d < days; d++) {
    if (!chance(0.6)) continue;
    const date = iso(dayOf(TODAY) - days + 1 + d);
    const ms = some(mentionable, 1 + Math.floor(rand() * 3));
    if (chance(0.15)) ms.push(pick(aliasNames));
    add('Nhật ký', date, { type: 'note' }, `# ${date}\n\n- ${pick(sentenceBits)}: ${ms.map((x) => L(x)).join(', ')}.\n`);
  }

  // --- render, then compute the answer key over the rendered files --------------------------------------
  const files = new Map();
  for (const [p, n] of [...notes].sort(([a], [b]) => (a < b ? -1 : 1))) files.set(p, renderFm(n.fm) + n.body + (ui ? EMBEDS[n.fm.type] || '' : ''));
  const kg = loadKg(files, schema);
  const P = (t) => titleTo.get(t);
  const cases = coreCases(P).concat(proceduralCases(P, orgs.slice(0, 8), kg));
  for (const c of cases) {
    const [mode, strategy] = MODES[c.id] || MODES[c.id.split(':')[0]];
    Object.assign(c, { mode, strategy });
    c.expect = c.query ? runQuery(kg, c.query) : c.queries.map((q) => runQuery(kg, q));
  }
  if (ui) {
    // The guide and config come after the cases: they hold no typed edge and link to no mentioned note, so the
    // cases stay as computed; stats below count the guide note.
    for (const [p, text] of [...baseFiles(TODAY), ...obsidianFiles(), ['Hướng dẫn thử.md', guide(cases)]]) files.set(p, text);
  }
  files.set(answers, JSON.stringify({
    about: 'Answer key for the kg-solo preset of obsidian-test-fixture. Every expect is what lib/kg.mjs computes over the files; dates compare as ISO strings, validity windows are inclusive.',
    generator: { preset: name, seed, clients, days },
    today: TODAY, schema, stats: ui ? stats(loadKg(files, schema)) : stats(kg), cases,
  }, null, 1) + '\n');
  return files;
}

// How a person reaches each case (`mode`) and how an agent should answer it (`strategy`); see
// obsidian-pkm-automation docs/knowledge-graph/usage.md.
//   mode: navigate (step through views), search (type a few words, get a report page), ask (question to an agent),
//         push (the system brings it up), write (suggestion while writing a note)
//   strategy: resolve (find the note from what was typed first), one-shot (the query is known up front, one or a
//         few fixed tool calls), explore (the path is not known up front: the agent walks the graph step by step;
//         `query` is only the reference used to grade, `budget` caps tool calls)
const MODES = {
  'browse-local-view': ['navigate', 'one-shot'], 'browse-moc-trail': ['navigate', 'one-shot'], 'browse-mentions': ['navigate', 'one-shot'],
  'multihop-conditions-downstream': ['ask', 'one-shot'], 'multihop-conditions-downstream-2025': ['ask', 'one-shot'],
  'multihop-path-polarity': ['ask', 'one-shot'], 'multihop-path-overload': ['ask', 'one-shot'], 'multihop-loops': ['ask', 'one-shot'],
  'multihop-moved-people': ['ask', 'explore'],
  'answer-contract-expiry': ['ask', 'one-shot'], 'answer-none-contract': ['ask', 'one-shot'], 'answer-none-active': ['ask', 'one-shot'], 'answer-why-churn': ['ask', 'explore'],
  'identity-alias': ['search', 'resolve'], 'identity-alias-edges': ['search', 'one-shot'], 'identity-collisions': ['push', 'one-shot'],
  'types-wrong-cause': ['ask', 'one-shot'], 'types-tools': ['navigate', 'one-shot'],
  'relations-inverse': ['ask', 'one-shot'], 'relations-symmetric': ['navigate', 'one-shot'], 'relations-part-of': ['navigate', 'one-shot'],
  'evidence-provenance': ['ask', 'one-shot'], 'evidence-disputed': ['ask', 'explore'],
  'causal-direct-causes': ['ask', 'one-shot'], 'causal-correlation-only': ['ask', 'one-shot'], 'causal-pending-upgrade': ['push', 'one-shot'],
  'time-contact-now': ['search', 'one-shot'], 'time-contact-then': ['ask', 'one-shot'], 'time-contact-boundary': ['ask', 'one-shot'],
  'time-price-now': ['search', 'one-shot'], 'time-decisions-2025': ['ask', 'one-shot'], 'time-decisions-now': ['search', 'one-shot'], 'time-contract-2025': ['ask', 'one-shot'],
  'nav-up-not-moc': ['navigate', 'one-shot'], 'nav-moc-children': ['navigate', 'one-shot'],
  'schema-validate': ['push', 'one-shot'], 'llm-pending': ['push', 'one-shot'], 'llm-created': ['push', 'one-shot'],
  'search-client-report': ['search', 'resolve'], 'resolve-no-diacritics': ['ask', 'resolve'], 'resolve-ambiguous-person': ['ask', 'resolve'],
  'resolve-duplicate-org': ['ask', 'resolve'], 'write-suggest-existing': ['write', 'resolve'],
  'explore-renewal-drivers': ['ask', 'explore'], 'explore-sleep-effects': ['ask', 'explore'],
  'gen-contact-now': ['search', 'one-shot'], 'gen-contact-2025': ['ask', 'one-shot'], 'gen-projects': ['search', 'one-shot'], 'gen-contract-now': ['search', 'one-shot'],
  'gen-tool-users': ['ask', 'one-shot'], 'gen-loops-all': ['ask', 'one-shot'], 'gen-revenue-upstream': ['ask', 'explore'],
};

// Hand-designed cases over the core story. Ids are stable across seeds and sizes; test/kg.test.mjs pins each
// expect by hand. `bt` is the problem number in obsidian-pkm-automation docs/knowledge-graph/README.md.
function coreCases(P) {
  const T = TODAY;
  const causal = ['increases', 'decreases', 'prevents'];
  return [
    { id: 'browse-local-view', bt: 'BT1', question: 'Mở note Dashboard doanh thu ABC: quanh nó có gì (mọi quan hệ có loại, cả hai chiều)?', query: { op: 'neighbors', node: P('Dashboard doanh thu ABC') } },
    { id: 'browse-moc-trail', bt: 'BT1', question: 'Đang ở MOC Dashboard ABC: đường điều hướng lên tới gốc là gì?', query: { op: 'reach', node: P('MOC Dashboard ABC'), rels: ['parent_moc'] } },
    { id: 'browse-mentions', bt: 'BT1', question: 'Những note nào nhắc tới Công ty ABC trong thân bài, kể cả nhắc bằng alias?', query: { op: 'mentions', node: P('Công ty ABC') } },
    { id: 'multihop-conditions-downstream', bt: 'BT2', question: 'Hợp đồng ABC hết hiệu lực thì những gì dừng theo?', query: { op: 'reach', node: P('Hợp đồng ABC còn hiệu lực'), rels: ['conditions'], asOf: T } },
    { id: 'multihop-conditions-downstream-2025', bt: 'BT2', question: 'Câu hỏi trên, nhưng hỏi vào giữa năm 2025 (trước khi có báo cáo tuần)?', query: { op: 'reach', node: P('Hợp đồng ABC còn hiệu lực'), rels: ['conditions'], asOf: '2025-06-01' } },
    { id: 'multihop-path-polarity', bt: 'BT2', question: 'Thanh toán trước 50% ảnh hưởng tới số lead mới qua đường nào, theo chiều nào?', query: { op: 'paths', from: P('Thanh toán trước 50%'), to: P('Số lead mới'), rels: causal, maxLen: 6 } },
    { id: 'multihop-path-overload', bt: 'BT2', question: 'Vì sao nhận thêm dự án làm chất lượng bàn giao giảm?', query: { op: 'paths', from: P('Số dự án song song'), to: P('Chất lượng bàn giao'), rels: causal, maxLen: 4 } },
    { id: 'multihop-loops', bt: 'BT2', question: 'Trong mô hình kinh doanh có những vòng nào, vòng nào tự tăng cường, vòng nào cân bằng?', query: { op: 'cycles', rels: causal, maxLen: 7 } },
    { id: 'multihop-moved-people', budget: 6, bt: 'BT2', question: 'Người làm ở ABC đầu năm 2025 nay làm ở khách hàng nào khác?', query: { op: 'chain', start: P('Công ty ABC'), steps: [{ rel: 'works_at', dir: 'in', asOf: '2025-01-01' }, { rel: 'works_at', dir: 'out', asOf: T }] } },
    { id: 'answer-contract-expiry', bt: 'BT3', question: 'Hợp đồng đang chạy với ABC hết hạn khi nào?', queries: [{ op: 'neighbors', node: P('Công ty ABC'), dir: 'in', rels: ['party'], asOf: T }, { op: 'field', node: P('HĐ ABC 2026'), key: 'valid_to' }] },
    { id: 'answer-none-contract', bt: 'BT3', question: 'Hợp đồng với Startup Lá Xanh hết hạn khi nào? (đúng là: không có hợp đồng)', none: true, query: { op: 'neighbors', node: P('Startup Lá Xanh'), dir: 'in', rels: ['party'] } },
    { id: 'answer-none-active', bt: 'BT3', question: 'Cửa hàng Mộc còn hợp đồng nào đang hiệu lực không? (đúng là: không, đã hết 2026-02-28)', none: true, query: { op: 'neighbors', node: P('Cửa hàng Mộc'), dir: 'in', rels: ['party'], asOf: T } },
    { id: 'answer-why-churn', budget: 10, bt: 'BT3', question: 'Vì sao thiếu ngủ có thể làm mất khách gia hạn?', query: { op: 'paths', from: P('Giờ ngủ'), to: P('Tỷ lệ gia hạn hợp đồng'), rels: causal, maxLen: 5 } },
    { id: 'identity-alias', bt: 'BT4', question: '"ABC Corp" là note nào?', query: { op: 'resolve', name: 'ABC Corp' } },
    { id: 'identity-alias-edges', bt: 'BT4', question: 'ABC có những dự án nào (kể cả dự án ghi khách hàng bằng alias)?', query: { op: 'neighbors', node: P('Công ty ABC'), dir: 'in', rels: ['client'] } },
    { id: 'identity-collisions', bt: 'BT4', question: 'Những note nào trùng tên sau khi bỏ dấu? Cặp nào là một, cặp nào là hai thứ khác nhau?', query: { op: 'collisions' }, labels: { [`${P('Cua hang Moc')}|${P('Cửa hàng Mộc')}`]: 'same: gộp', [`${P('Nguyễn Văn An')}|${P('Nguyễn Văn Ân')}`]: 'different: không gộp, đổi tên cho khác' } },
    { id: 'types-wrong-cause', bt: 'BT5', question: 'Cà phê là loại note gì, và nó đang được ghi làm nguyên nhân của gì? (đồ vật không được làm nguyên nhân)', queries: [{ op: 'field', node: P('Cà phê'), key: 'type' }, { op: 'neighbors', node: P('Cà phê'), dir: 'out', rels: ['increases', 'decreases', 'conditions', 'prevents'] }] },
    { id: 'types-tools', bt: 'BT5', question: 'Liệt kê mọi công cụ.', query: { op: 'select', where: { type: 'tool' } } },
    { id: 'relations-inverse', bt: 'BT6', question: 'Dự án nào dùng Metabase? (quan hệ ngược, chỉ ghi ở phía dự án)', query: { op: 'neighbors', node: P('Metabase'), dir: 'in', rels: ['uses'] } },
    { id: 'relations-symmetric', bt: 'BT6', question: 'Supabase liên quan tới gì? (related chỉ ghi ở Webflow)', query: { op: 'neighbors', node: P('Supabase'), dir: 'out', rels: ['related'] } },
    { id: 'relations-part-of', bt: 'BT6', question: 'Chiến dịch Tết Mộc gồm những phần nào?', query: { op: 'neighbors', node: P('Chiến dịch Tết Mộc'), dir: 'in', rels: ['part_of'] } },
    { id: 'evidence-provenance', bt: 'BT7', question: 'Khẳng định "thanh toán trước chặn nợ quá hạn" lấy từ đâu, đoạn nào?', query: { op: 'provenance', claim: P('Thanh toán trước chặn nợ quá hạn') } },
    { id: 'evidence-disputed', budget: 6, bt: 'BT7', question: 'Khẳng định "giảm giá giữ chân khách cũ" có nguồn nào ủng hộ, nguồn nào phản bác?', query: { op: 'provenance', claim: P('Giảm giá giữ chân khách cũ') } },
    { id: 'causal-direct-causes', bt: 'BT8', question: 'Cái gì trực tiếp làm tăng số lead mới? (tương quan không tính)', query: { op: 'neighbors', node: P('Số lead mới'), dir: 'in', rels: ['increases', 'conditions'] } },
    { id: 'causal-correlation-only', bt: 'BT8', question: 'LinkedIn và số lead: quan hệ đã được chấp nhận ở bậc nào?', query: { op: 'neighbors', node: P('Số lead mới'), rels: ['correlates_with', 'increases', 'conditions'], dir: 'both' } },
    { id: 'causal-pending-upgrade', bt: 'BT8', question: 'Có đề xuất nào đang chờ nâng một quan hệ lên bậc điều kiện không?', query: { op: 'neighbors', node: P('Số lead mới'), dir: 'in', rels: ['conditions'], statuses: ['proposed'] } },
    { id: 'time-contact-now', bt: 'BT9', question: 'Đầu mối của ABC bây giờ là ai?', query: { op: 'neighbors', node: P('Công ty ABC'), dir: 'in', rels: ['contact_for'], asOf: T } },
    { id: 'time-contact-then', bt: 'BT9', question: 'Lúc ký hợp đồng 2025, đầu mối của ABC là ai?', query: { op: 'neighbors', node: P('Công ty ABC'), dir: 'in', rels: ['contact_for'], asOf: '2025-01-01' } },
    { id: 'time-contact-boundary', bt: 'BT9', question: 'Ngày 2026-04-01 (ngày bàn giao) đầu mối của ABC là ai?', query: { op: 'neighbors', node: P('Công ty ABC'), dir: 'in', rels: ['contact_for'], asOf: '2026-04-01' } },
    { id: 'time-price-now', bt: 'BT9', question: 'Bảng giá nào đang áp dụng?', query: { op: 'valid', type: 'document', asOf: T } },
    { id: 'time-decisions-2025', bt: 'BT9', question: 'Giữa năm 2025 đang theo quyết định nào?', query: { op: 'valid', type: 'decision', asOf: '2025-06-01' } },
    { id: 'time-decisions-now', bt: 'BT9', question: 'Bây giờ đang theo quyết định nào?', query: { op: 'valid', type: 'decision', asOf: T } },
    { id: 'time-contract-2025', bt: 'BT9', question: 'Giữa năm 2025, hợp đồng nào với ABC đang hiệu lực?', query: { op: 'neighbors', node: P('Công ty ABC'), dir: 'in', rels: ['party'], asOf: '2025-06-01' } },
    { id: 'nav-up-not-moc', bt: 'BT10', question: 'Báo cáo tuần là con của những khái niệm nào? (MOC chứa nó không tính)', query: { op: 'reach', node: P('Báo cáo tuần'), rels: ['up'] } },
    { id: 'nav-moc-children', bt: 'BT10', question: 'MOC Kinh doanh có những MOC con nào?', query: { op: 'neighbors', node: P('MOC Kinh doanh'), dir: 'in', rels: ['parent_moc'] } },
    { id: 'schema-validate', bt: 'BT11', question: 'Vault vi phạm luật schema nào, ở note nào?', query: { op: 'validate' } },
    { id: 'llm-pending', bt: 'BT12', question: 'Đề xuất nào của LLM đang chờ người duyệt?', query: { op: 'select', where: { type: 'claim', status: 'proposed', proposed_by: 'llm' } } },
    { id: 'search-client-report', bt: 'BT3', question: 'Gõ "abc": trang tổng hợp của khách hàng này (đầu mối hiện tại, hợp đồng đang chạy, dự án).', queries: [{ op: 'find', name: 'abc', type: 'organization' }, { op: 'neighbors', node: P('Công ty ABC'), dir: 'in', rels: ['contact_for'], asOf: T }, { op: 'neighbors', node: P('Công ty ABC'), dir: 'in', rels: ['party'], asOf: T }, { op: 'neighbors', node: P('Công ty ABC'), dir: 'in', rels: ['client'] }] },
    { id: 'resolve-no-diacritics', bt: 'BT4', question: 'Gõ "cong ty abc" (không dấu): là note nào?', query: { op: 'find', name: 'cong ty abc' } },
    { id: 'resolve-ambiguous-person', bt: 'BT4', question: 'Hỏi "anh nguyen van an ở công ty nào?": tên khớp hai người, phải hỏi lại chứ không chọn bừa.', behavior: 'clarify', query: { op: 'find', name: 'nguyen van an', type: 'person' } },
    { id: 'resolve-duplicate-org', bt: 'BT4', question: 'Hỏi về "moc": hai note khách hàng khớp, thực ra là một (một bản do LLM tạo trùng).', behavior: 'merge-aware', query: { op: 'find', name: 'moc', type: 'organization' } },
    { id: 'write-suggest-existing', bt: 'BT4', question: 'Đang viết note mới "Mộc Store": gợi ý note đã có thay vì tạo trùng.', query: { op: 'find', name: 'Mộc Store' } },
    { id: 'explore-renewal-drivers', bt: 'BT2', question: 'Những gì ảnh hưởng tới tỷ lệ gia hạn hợp đồng, trực tiếp hay gián tiếp, chỉ tính quan hệ đã chấp nhận?', budget: 12, query: { op: 'reach', node: P('Tỷ lệ gia hạn hợp đồng'), dir: 'in', rels: ['increases', 'decreases', 'prevents'], maxDepth: 3 } },
    { id: 'explore-sleep-effects', bt: 'BT8', question: 'Nếu ngủ ít đi thì việc kinh doanh bị ảnh hưởng thế nào, qua những bước nào?', budget: 12, query: { op: 'paths', from: P('Giờ ngủ'), to: P('Số dự án song song'), rels: ['increases', 'decreases', 'prevents'], maxLen: 6 } },
    { id: 'llm-created', bt: 'BT12', question: 'Note nào do LLM tạo hoặc sửa (cần xem lại)?', query: { op: 'select', where: { proposed_by: 'llm' } } },
  ];
}

// A few cases per procedural client, so an index built at scale is checked too, not only the core.
function proceduralCases(P, orgs, kg) {
  const out = [];
  for (const o of orgs) {
    const id = P(o);
    out.push({ id: `gen-contact-now:${o}`, bt: 'BT9', question: `Đầu mối của ${o} bây giờ là ai?`, query: { op: 'neighbors', node: id, dir: 'in', rels: ['contact_for'], asOf: TODAY } });
    out.push({ id: `gen-contact-2025:${o}`, bt: 'BT9', question: `Đầu mối của ${o} ngày 2025-01-01 là ai?`, query: { op: 'neighbors', node: id, dir: 'in', rels: ['contact_for'], asOf: '2025-01-01' } });
    out.push({ id: `gen-projects:${o}`, bt: 'BT4', question: `${o} có những dự án nào (kể cả ghi bằng alias)?`, query: { op: 'neighbors', node: id, dir: 'in', rels: ['client'] } });
    out.push({ id: `gen-contract-now:${o}`, bt: 'BT3', question: `${o} còn hợp đồng nào đang hiệu lực?`, query: { op: 'neighbors', node: id, dir: 'in', rels: ['party'], asOf: TODAY } });
  }
  for (const t of ['WordPress', 'Looker Studio', 'n8n']) out.push({ id: `gen-tool-users:${t}`, bt: 'BT6', question: `Dự án nào dùng ${t}?`, query: { op: 'neighbors', node: P(t), dir: 'in', rels: ['uses'] } });
  out.push({ id: 'gen-loops-all', bt: 'BT2', question: 'Mọi vòng nhân quả tới 10 bước (tăng theo số khách hàng).', query: { op: 'cycles', rels: ['increases', 'decreases', 'prevents'], maxLen: 10 } });
  out.push({ id: 'gen-revenue-upstream', budget: 15, bt: 'BT2', question: 'Những gì (nhiều bước) làm tăng doanh thu định kỳ?', query: { op: 'reach', node: P('Doanh thu định kỳ'), dir: 'in', rels: ['increases'] } });
  void kg;
  return out;
}
