// kg-solo: hand-written answers for the core story, the planted errors at every size, and the answer key
// agreeing with the files on disk.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { tmpDir } from './helpers.mjs';
import { generate } from '../lib/index.mjs';
import { loadKg, readVault, runQuery } from '../lib/kg.mjs';
import { buildGraph } from '../lib/graph.mjs';
import { fileURLToPath } from 'node:url';

const make = (options) => {
  const out = path.join(tmpDir('otf-kg-'), 'v');
  generate({ preset: 'kg-solo', out, options });
  const key = JSON.parse(fs.readFileSync(path.join(out, '.kg-answers.json'), 'utf8'));
  return { out, key, expect: (id) => key.cases.find((c) => c.id === id).expect };
};
const core = make({ clients: 0, days: 30 });
const big = make({ clients: 120, days: 400 });

const F = (t) => `Yếu tố/${t}.md`;
const nb = (rel, node) => ({ rel, node });

// Every hand-designed case, answered by hand. The same answers must hold at any size, except where the case
// itself grows with the vault (mentions); those are checked separately.
const HAND = {
  'browse-local-view': [nb('affected_by', 'Quyết định/Chuyển dashboard sang Metabase.md'), nb('client', 'Khách hàng/Công ty ABC.md'), nb('covered_by', 'Hợp đồng/HĐ ABC 2026.md'), nb('uses', 'Công cụ/Google Sheets.md'), nb('uses', 'Công cụ/Metabase.md'), nb('uses', 'Khái niệm/Phân tích dữ liệu.md')],
  'browse-moc-trail': ['MOC/MOC Dự án.md', 'MOC/MOC Kinh doanh.md'],
  'multihop-conditions-downstream': [F('Báo cáo tuần cho ABC'), F('Doanh thu dự án dashboard ABC'), F('Khả năng cập nhật dashboard ABC'), F('Quyền truy cập dữ liệu ABC')],
  'multihop-conditions-downstream-2025': [F('Doanh thu dự án dashboard ABC'), F('Khả năng cập nhật dashboard ABC'), F('Quyền truy cập dữ liệu ABC')],
  'multihop-path-polarity': [{ nodes: [F('Thanh toán trước 50%'), F('Nợ quá hạn'), F('Dòng tiền'), F('Ngân sách marketing'), F('Số lead mới')], rels: ['prevents', 'decreases', 'increases', 'increases'], sign: '+' }],
  'multihop-path-overload': [{ nodes: [F('Số dự án song song'), F('Khối lượng việc'), F('Chất lượng bàn giao')], rels: ['increases', 'decreases'], sign: '-' }],
  'multihop-loops': [
    { nodes: [F('Doanh thu định kỳ'), F('Ngân sách marketing'), F('Số lead mới'), F('Số dự án song song')], rels: ['increases', 'increases', 'increases', 'increases'], negatives: 0, kind: 'reinforcing' },
    { nodes: [F('Chất lượng bàn giao'), F('Mức hài lòng khách hàng'), F('Tỷ lệ gia hạn hợp đồng'), F('Số dự án song song'), F('Khối lượng việc')], rels: ['increases', 'increases', 'increases', 'increases', 'decreases'], negatives: 1, kind: 'balancing' },
    { nodes: [F('Giờ ngủ'), F('Mức kiệt sức'), F('Thời gian phản hồi khách'), F('Mức hài lòng khách hàng'), F('Tỷ lệ gia hạn hợp đồng'), F('Số dự án song song'), F('Khối lượng việc')], rels: ['decreases', 'increases', 'decreases', 'increases', 'increases', 'increases', 'decreases'], negatives: 3, kind: 'balancing' },
  ],
  'multihop-moved-people': ['Khách hàng/Startup Lá Xanh.md'],
  'answer-contract-expiry': [[nb('has_contract', 'Hợp đồng/HĐ ABC 2026.md')], '2026-12-31'],
  'answer-none-contract': [],
  'answer-none-active': [],
  'answer-why-churn': [{ nodes: [F('Giờ ngủ'), F('Mức kiệt sức'), F('Thời gian phản hồi khách'), F('Mức hài lòng khách hàng'), F('Tỷ lệ gia hạn hợp đồng')], rels: ['decreases', 'increases', 'decreases', 'increases'], sign: '+' }],
  'identity-alias': { id: 'Khách hàng/Công ty ABC.md', via: 'alias' },
  'identity-alias-edges': [nb('has_project', 'Dự án/Dashboard doanh thu ABC.md'), nb('has_project', 'Dự án/Website ABC 2025.md')],
  'identity-collisions': [['Khách hàng/Cua hang Moc.md', 'Khách hàng/Cửa hàng Mộc.md'], ['Người/Nguyễn Văn An.md', 'Người/Nguyễn Văn Ân.md']],
  'types-wrong-cause': ['concept', [nb('increases', F('Mức kiệt sức'))]],
  'search-client-report': [['Khách hàng/Công ty ABC.md'], [nb('contact', 'Người/Trần Thị Bình.md')], [nb('has_contract', 'Hợp đồng/HĐ ABC 2026.md')], [nb('has_project', 'Dự án/Dashboard doanh thu ABC.md'), nb('has_project', 'Dự án/Website ABC 2025.md')]],
  'resolve-no-diacritics': ['Khách hàng/Công ty ABC.md'],
  'resolve-ambiguous-person': ['Người/Nguyễn Văn An.md', 'Người/Nguyễn Văn Ân.md'],
  'resolve-duplicate-org': ['Khách hàng/Cua hang Moc.md', 'Khách hàng/Cửa hàng Mộc.md'],
  'write-suggest-existing': ['Khách hàng/Cửa hàng Mộc.md'],
  'explore-renewal-drivers': [F('Chất lượng bàn giao'), F('Khối lượng việc'), F('Mức hài lòng khách hàng'), F('Mức kiệt sức'), F('Thời gian phản hồi khách')],
  'explore-sleep-effects': [{ nodes: [F('Giờ ngủ'), F('Mức kiệt sức'), F('Thời gian phản hồi khách'), F('Mức hài lòng khách hàng'), F('Tỷ lệ gia hạn hợp đồng'), F('Số dự án song song')], rels: ['decreases', 'increases', 'decreases', 'increases', 'increases'], sign: '+' }],
  'relations-inverse': [nb('used_by', 'Dự án/Dashboard doanh thu ABC.md')],
  'relations-symmetric': [nb('related', 'Công cụ/Webflow.md')],
  'relations-part-of': [nb('has_part', 'Dự án/Landing page Tết Mộc.md')],
  'evidence-provenance': { sources: [{ note: 'Họp/Họp Mộc 2025-09-05.md', block: 'tt50' }], evidence: [] },
  'evidence-disputed': { sources: [{ note: 'Nguồn/Sách Bán hàng tư vấn.md', block: null }], evidence: [{ rel: 'disputes', from: 'Nguồn/Báo cáo khảo sát khách 2026.md' }, { rel: 'supports', from: 'Nguồn/Sách Bán hàng tư vấn.md' }] },
  'causal-direct-causes': [nb('increased_by', F('Ngân sách marketing'))],
  'causal-correlation-only': [nb('correlates_with', F('Số bài đăng LinkedIn')), nb('increased_by', F('Ngân sách marketing')), nb('increases', F('Số dự án song song'))],
  'causal-pending-upgrade': [nb('conditioned_by', F('Ngân sách marketing')), nb('conditioned_by', F('Số bài đăng LinkedIn'))],
  'time-contact-now': [nb('contact', 'Người/Trần Thị Bình.md')],
  'time-contact-then': [nb('contact', 'Người/Nguyễn Văn An.md')],
  'time-contact-boundary': [nb('contact', 'Người/Trần Thị Bình.md')],
  'time-price-now': ['Tài liệu/Bảng giá 2026.md'],
  'time-decisions-2025': ['Quyết định/Nhận dự án giá cố định.md'],
  'time-decisions-now': ['Quyết định/Chuyển dashboard sang Metabase.md', 'Quyết định/Chỉ nhận dự án tính theo giờ.md'],
  'time-contract-2025': [nb('has_contract', 'Hợp đồng/HĐ ABC 2025.md')],
  'nav-up-not-moc': ['Khái niệm/Dashboard.md', 'Khái niệm/Phân tích dữ liệu.md'],
  'nav-moc-children': [nb('child_moc', 'MOC/MOC Dự án.md'), nb('child_moc', 'MOC/MOC Khách hàng.md')],
  'llm-pending': ['Claim/LinkedIn là điều kiện có lead.md', 'Claim/Nhiều việc làm chậm phản hồi.md'],
  'llm-created': ['Claim/LinkedIn là điều kiện có lead.md', 'Claim/Nhiều việc làm chậm phản hồi.md', 'Claim/Phản hồi nhanh là điều kiện gia hạn.md', 'Khách hàng/Cua hang Moc.md', F('Số bài đăng LinkedIn')],
};

// The planted errors, one per rule, and nothing else at any size.
const PLANTED = [
  ['R2', F('Số bài đăng LinkedIn')], ['R3', 'Dự án/Chiến dịch Tết Mộc.md'], ['R4', 'Khái niệm/Chân dung khách hàng.md'], ['R4', 'Khái niệm/Cà phê.md'],
  ['R5', 'Công cụ/Metabase.md'], ['R6', 'Khái niệm/Dashboard.md'], ['R7', 'Khái niệm/Marketing số.md'], ['R8', 'Khách hàng/Cửa hàng Mộc.md'], ['R8', 'Người/Nguyễn Văn Ân.md'],
  ['R9', 'Claim/Ngân sách là điều kiện có lead.md'], ['R9', 'Claim/Nhiều việc làm chậm phản hồi.md'], ['R10', 'Claim/Phản hồi nhanh là điều kiện gia hạn.md'],
];

for (const [name, v] of [['core', core], ['120 clients', big]]) {
  test(`hand-written answers hold: ${name}`, () => {
    for (const [id, want] of Object.entries(HAND)) assert.deepEqual(v.expect(id), want, id);
  });
  test(`only the planted errors: ${name}`, () => {
    assert.deepEqual(v.expect('schema-validate').map((e) => [e.rule, e.note]), PLANTED);
  });
  test(`answer key matches the files on disk: ${name}`, () => {
    const kg = loadKg(readVault(v.out), v.key.schema);
    for (const c of v.key.cases) assert.deepEqual(c.query ? runQuery(kg, c.query) : c.queries.map((q) => runQuery(kg, q)), c.expect, c.id);
  });
}

test('every BT1-BT12 has at least two cases, every case has a question', () => {
  for (let k = 1; k <= 12; k++) assert.ok(core.key.cases.filter((c) => c.bt === `BT${k}`).length >= (k === 11 ? 1 : 2), `BT${k}`);
  assert.ok(core.key.cases.every((c) => c.question && (c.query || c.queries)));
});

test('every case has a mode and a strategy; explore cases carry a tool budget', () => {
  const modes = new Set(['navigate', 'search', 'ask', 'push', 'write']), strategies = new Set(['resolve', 'one-shot', 'explore']);
  for (const c of big.key.cases) {
    assert.ok(modes.has(c.mode) && strategies.has(c.strategy), c.id);
    if (c.strategy === 'explore') assert.ok(c.budget > 0, c.id);
  }
  for (const s of strategies) assert.ok(core.key.cases.filter((c) => c.strategy === s).length >= 3, s);
});

test('mentions: core notes plus daily notes, alias links included', () => {
  for (const v of [core, big]) {
    const m = v.expect('browse-mentions');
    for (const n of ['Dự án/Dashboard doanh thu ABC.md', 'Họp/Họp ABC 2026-02-10.md', 'MOC/MOC Khách hàng.md']) assert.ok(m.includes(n), n);
    assert.ok(m.every((n) => /^(Dự án|Họp|MOC|Nhật ký|Khách hàng)\//.test(n)), m.join());
  }
});

test('scale: two loops per client, procedural cases resolve, notes grow with clients', () => {
  assert.equal(big.expect('gen-loops-all').length, 3 + 2 * 120);
  assert.ok(big.key.stats.notes > 1900, String(big.key.stats.notes));
  const gen = big.key.cases.filter((c) => c.id.startsWith('gen-contact-now:'));
  assert.equal(gen.length, 8);
  assert.ok(gen.every((c) => c.expect.length === 1 && c.expect[0].rel === 'contact'));
});

test('same options twice: identical tree; another seed changes it', () => {
  const a = make({ clients: 20, days: 60 }), b = make({ clients: 20, days: 60 }), c = make({ clients: 20, days: 60, seed: 12 });
  const hash = (v) => JSON.parse(fs.readFileSync(path.join(v.out, '.fixture-manifest.json'), 'utf8')).treeHash;
  assert.equal(hash(a), hash(b));
  assert.notEqual(hash(a), hash(c));
});

test('graph export names the frontmatter key of each typed link', () => {
  const g = buildGraph(core.out);
  const e = g.edges.filter((x) => x.from === 'Dự án/Dashboard doanh thu ABC.md' && x.kind === 'frontmatter');
  assert.deepEqual(e.map((x) => [x.key, x.target, x.resolved]), [['client', 'ABC Corp', false], ['uses', 'Metabase', true], ['uses', 'Google Sheets', true], ['uses', 'Phân tích dữ liệu', true]]);
  assert.ok(g.edges.filter((x) => x.kind !== 'frontmatter').every((x) => !('key' in x)));
});

test('otf kg: case check and query from the CLI', () => {
  const run = (...a) => JSON.parse(spawnSync(process.execPath, [fileURLToPath(new URL('../bin/otf.mjs', import.meta.url)), 'kg', core.out, ...a], { encoding: 'utf8' }).stdout);
  assert.equal(run('case', 'time-contact-then').ok, true);
  assert.deepEqual(run('query', JSON.stringify({ op: 'resolve', name: 'Mộc Store' })), { id: 'Khách hàng/Cửa hàng Mộc.md', via: 'alias' });
  assert.equal(run('validate').length, PLANTED.length);
});
