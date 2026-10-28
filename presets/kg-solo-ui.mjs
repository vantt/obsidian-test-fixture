// UI layer of the kg-solo preset (--ui): config for Obsidian 1.15 core Bases plus the settings files of the
// Breadcrumbs and ExcaliBrain community plugins, .base files, views embedded in report pages, and a hands-on guide
// whose exercises are tied to answer-key cases. No plugin code is written; the user installs the plugins, which
// then find their data.json already in place.
//
// Sources (checked 2026-10-27):
//   .base syntax   https://obsidian.md/help/bases/syntax, /bases/functions, /bases/create-base (embed: ![[File.base#View]])
//   Breadcrumbs    4.22.1 (github.com/michaelpporter/breadcrumbs, minAppVersion 1.14.0): src/interfaces/settings.ts
//                  (edge_fields, edge_field_groups, implied_relations.transitive), src/const/settings.ts (defaults);
//                  main.ts merges data.json over defaults with deep_merge_objects, arrays are NOT merged
//   ExcaliBrain    0.2.19 (github.com/zsviczian/excalibrain): src/Types.ts `Hierarchy`, src/constants/constants.ts
//                  DEFAULT_HIERARCHY_DEFINITION; settings = Object.assign({}, DEFAULT_SETTINGS, loadData()), shallow,
//                  so `hierarchy` must be complete. Needs the Dataview and Excalidraw plugins.

const j = (v) => JSON.stringify(v, null, 2) + '\n';
const BASES = 'Bases';
const ASOF = (today) => `date("${today}")`;

// --- .base files -----------------------------------------------------------------------------------------
// Every base has one view over the whole vault and one "Của trang này" view filtered by `this.file`: when the
// base is embedded in a note, `this` is that note. Dates are compared with a fixed `asof` (the answer key's
// today), not today(), so the views agree with the key whatever day the vault is opened.

const current = (today) => `formulas:
  asof: '${ASOF(today)}'
  hieu_luc: 'valid_from <= formula.asof && (valid_to.isEmpty() || valid_to >= formula.asof)'
`;

export function baseFiles(today) {
  const files = new Map();
  const put = (name, text) => files.set(`${BASES}/${name}.base`, text);

  put('Đầu mối hiện tại', `filters:
  and:
    - file.inFolder("Claim")
    - 'relation == "contact_for"'
    - 'status == "accepted" || status == "superseded"'
${current(today)}properties:
  subject:
    displayName: Người
  object:
    displayName: Khách hàng
  valid_from:
    displayName: Từ ngày
  valid_to:
    displayName: Đến ngày
views:
  - type: table
    name: Tất cả đầu mối hiện tại
    filters:
      and:
        - formula.hieu_luc
    order:
      - object
      - subject
      - valid_from
  - type: table
    name: Của trang này
    filters:
      and:
        - formula.hieu_luc
        - file.hasLink(this.file)
    order:
      - subject
      - object
      - valid_from
`);

  put('Hợp đồng đang chạy', `filters:
  and:
    - file.inFolder("Hợp đồng")
${current(today)}properties:
  party:
    displayName: Bên ký
  covers:
    displayName: Phạm vi
  value:
    displayName: Giá trị
views:
  - type: table
    name: Tất cả hợp đồng đang chạy
    filters:
      and:
        - formula.hieu_luc
    order:
      - file.name
      - party
      - covers
      - valid_to
      - value
  - type: table
    name: Của trang này
    filters:
      and:
        - formula.hieu_luc
        - file.hasLink(this.file)
    order:
      - file.name
      - covers
      - valid_to
      - value
`);

  put('Dự án', `filters:
  and:
    - file.inFolder("Dự án")
properties:
  client:
    displayName: Khách hàng
  uses:
    displayName: Công cụ
  start:
    displayName: Bắt đầu
views:
  - type: table
    name: Tất cả dự án
    order:
      - file.name
      - client
      - status
      - start
      - uses
  - type: table
    name: Đang chạy
    filters:
      and:
        - 'status == "active"'
    order:
      - file.name
      - client
      - start
      - uses
  - type: table
    name: Của trang này
    filters:
      and:
        - file.hasLink(this.file)
    order:
      - file.name
      - status
      - start
      - uses
`);

  put('Đề xuất LLM chờ duyệt', `filters:
  and:
    - file.inFolder("Claim")
    - 'status == "proposed"'
    - 'proposed_by == "llm"'
properties:
  relation:
    displayName: Quan hệ
  cause:
    displayName: Nguyên nhân
  effect:
    displayName: Kết quả
  confidence:
    displayName: Độ tin
views:
  - type: table
    name: Chờ duyệt
    order:
      - file.name
      - relation
      - cause
      - effect
      - confidence
`);

  put('Claim theo yếu tố', `filters:
  and:
    - file.inFolder("Claim")
properties:
  relation:
    displayName: Quan hệ
  cause:
    displayName: Nguyên nhân
  effect:
    displayName: Kết quả
  status:
    displayName: Trạng thái
views:
  - type: table
    name: Của trang này
    filters:
      and:
        - file.hasLink(this.file)
    order:
      - file.name
      - relation
      - cause
      - effect
      - status
      - confidence
`);
  return files;
}

// Views embedded in report pages, by note type. Embeds have no note target, so the answer key is not affected.
const embed = (base, view) => `![[${BASES}/${base}.base#${view}]]`;
export const EMBEDS = {
  organization: `\n## Tổng hợp\n\n### Đầu mối hiện tại\n\n${embed('Đầu mối hiện tại', 'Của trang này')}\n\n### Hợp đồng đang chạy\n\n${embed('Hợp đồng đang chạy', 'Của trang này')}\n\n### Dự án\n\n${embed('Dự án', 'Của trang này')}\n`,
  project: `\n## Tổng hợp\n\n### Hợp đồng đang chạy\n\n${embed('Hợp đồng đang chạy', 'Của trang này')}\n`,
  factor: `\n## Tổng hợp\n\n### Claim liên quan\n\n${embed('Claim theo yếu tố', 'Của trang này')}\n`,
};

// --- plugin settings -------------------------------------------------------------------------------------

// Breadcrumbs v4 reads edges written in frontmatter or inline fields; opposite directions are implied by
// transitive rules (chain one field, close with the other, reversed). Arrays are not merged with the defaults,
// so edge_fields, edge_field_groups and implied_relations.transitive are given in full.
const PAIRS = [['up', 'down'], ['parent_moc', 'child_moc'], ['part_of', 'has_part'], ['conditions', 'conditioned_by'], ['next', 'prev']];
export const BC_FIELDS = [...PAIRS.flat(), 'related'];
export const BC_GROUPS = [
  { label: 'ups', fields: ['up', 'parent_moc', 'part_of'] },
  { label: 'downs', fields: ['down', 'child_moc', 'has_part'] },
  { label: 'sames', fields: ['related'] },
  { label: 'conditions', fields: ['conditions'] },
  { label: 'conditioned_by', fields: ['conditioned_by'] },
  { label: 'nexts', fields: ['next'] },
  { label: 'prevs', fields: ['prev'] },
];

export function breadcrumbsData() {
  const rule = (from, to) => ({ name: '', rounds: 1, chain: [{ field: from }], close_field: to, close_reversed: true });
  return {
    edge_fields: BC_FIELDS.map((label) => ({ label })),
    edge_field_groups: BC_GROUPS,
    implied_relations: { transitive: [...PAIRS.flatMap(([a, b]) => [rule(a, b), rule(b, a)]), rule('related', 'related')] },
    views: { page: { trail: { enabled: true, default_depth: 6, format: 'path', field_group_labels: ['ups'] }, prev_next: { enabled: false } } },
  };
}

// ExcaliBrain: siblings are children of the same parent (inferred); `related` is a friend (same level).
export const EXCALIBRAIN_HIERARCHY = {
  exclusions: ['excalidraw-font', 'excalidraw-font-color', 'excalidraw-css', 'excalidraw-plugin', 'excalidraw-link-brackets', 'excalidraw-link-prefix', 'excalidraw-border-color', 'excalidraw-default-mode', 'excalidraw-export-dark', 'excalidraw-export-transparent', 'excalidraw-export-svgpadding', 'excalidraw-export-pngscale', 'excalidraw-url-prefix', 'excalidraw-linkbutton-opacity', 'excalidraw-onload-script', 'kanban-plugin'],
  parents: ['up', 'parent_moc', 'part_of'],
  children: ['down', 'child_moc', 'has_part'],
  leftFriends: ['related'],
  rightFriends: [],
  previous: ['prev'],
  next: ['next'],
  hidden: ['hidden'],
};

export function obsidianFiles() {
  const f = new Map();
  f.set('.obsidian/app.json', j({ alwaysUpdateLinks: true, useMarkdownLinks: false, newLinkFormat: 'shortest' }));
  f.set('.obsidian/core-plugins.json', j({ 'file-explorer': true, 'global-search': true, switcher: true, backlink: true, outgoing_link: true, 'tag-pane': true, properties: true, bases: true, 'page-preview': true, outline: true }));
  // Property types so Bases compares dates and numbers, not text.
  f.set('.obsidian/types.json', j({ types: { valid_from: 'date', valid_to: 'date', start: 'date', date: 'date', value: 'number', year: 'number', aliases: 'aliases', tags: 'tags' } }));
  f.set('.obsidian/plugins/breadcrumbs/data.json', j(breadcrumbsData()));
  f.set('.obsidian/plugins/excalibrain/data.json', j({ hierarchy: EXCALIBRAIN_HIERARCHY }));
  return f;
}

// --- hands-on guide --------------------------------------------------------------------------------------

const title = (id) => id.replace(/^.*\//, '').replace(/\.md$/, '');
function show(v) {
  if (v === null || v === undefined) return 'không có';
  if (typeof v === 'string') return v.endsWith('.md') ? title(v) : v;
  if (Array.isArray(v)) return v.length ? v.map(show).join('; ') : 'rỗng (đúng là không có)';
  if (v.rel && v.node) return `${v.rel}: ${title(v.node)}`;
  if (v.nodes) return v.nodes.map(title).join(' → ');
  if (v.id) return title(v.id);
  return JSON.stringify(v);
}

// One exercise: what to do, which case's answer to compare with. `pick` selects part of a multi-query expect.
const way1 = [
  ['browse-moc-trail', 'Mở [[MOC Dashboard ABC]]. Nhìn thanh breadcrumb (trail) ở đầu trang.', 'Đường lên gốc qua `parent_moc`.'],
  ['nav-moc-children', 'Mở [[MOC Kinh doanh]]. Mở panel Breadcrumbs (matrix), nhóm `downs`.', 'MOC con (quan hệ ngược `child_moc`, chỉ ghi ở phía con).'],
  ['nav-up-not-moc', 'Mở [[Báo cáo tuần]]. Trail theo nhóm `ups`.', 'Khái niệm cha qua `up`; MOC chứa nó KHÔNG được hiện.'],
  ['relations-part-of', 'Mở [[Chiến dịch Tết Mộc]]. Panel Breadcrumbs, nhóm `downs`.', 'Phần của chiến dịch (`has_part`, ngược của `part_of`).'],
  ['relations-symmetric', 'Mở [[Supabase]]. ExcaliBrain: node bạn (friend) cùng cấp.', '`related` chỉ ghi ở một phía; phải thấy cả hai chiều.'],
  ['browse-local-view', 'Mở [[Dashboard doanh thu ABC]]. ExcaliBrain: cha ở trên, con ở dưới, cùng cấp hai bên.', 'Mọi quan hệ có loại quanh note, hai chiều. Lưu ý: note này chỉ có `client`, `uses`, không có `up`/`part_of`, nên ExcaliBrain chỉ dựng từ liên kết thường (liên kết xuôi là con, ngược là cha), không từ trường đã khai. Đối chiếu, không cần khớp từng khoá tên.'],
];
const way2 = [
  ['identity-alias', 'Ctrl/Cmd+O, gõ `ABC Corp`.', 'Quick Switcher có nhảy tới đúng khách hàng không (qua alias)?'],
  ['search-client-report', 'Gõ `abc`, mở khách hàng. Kéo xuống mục "Tổng hợp" (ba view nhúng: đầu mối, hợp đồng, dự án).', 'Bốn câu trong một trang. Đáp án khoá là 2 dự án, nhưng đã đo trên Obsidian 1.15.0: view chỉ ra 1 (Website ABC 2025), thiếu dự án ghi khách bằng alias vì `file.hasLink` không nối alias (BT4). Nếu bạn thấy 2 thì Obsidian đã đổi, ghi lại.'],
  ['time-contact-now', 'Trong trang khách hàng đó, đọc view "Đầu mối hiện tại".', 'Đầu mối bây giờ (vào view bằng `asof` cố định 2026-10-15). Người cũ không được hiện.'],
  ['time-price-now', 'Gõ `bảng giá`, mở hai bảng giá, so `valid_from` / `valid_to`.', 'Bảng giá đang áp dụng.'],
  ['time-decisions-now', 'Gõ `quyết định`, đọc `valid_from` / `valid_to` / `superseded_by` của từng cái.', 'Các quyết định còn hiệu lực (quyết định đã bị đảo thì không).'],
  ['llm-pending', 'Mở `Bases/Đề xuất LLM chờ duyệt.base`.', 'Đề xuất của LLM đang chờ người duyệt.'],
];

export function guide(cases) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const row = ([id, todo, note], i) => {
    const c = byId.get(id);
    if (!c) throw new Error(`guide: no case ${id}`);
    return `### ${i + 1}. ${c.question}\n\n- Làm: ${todo}\n- Đáp án: ${show(c.expect)}\n- Ghi chú: ${note}\n- Kết quả của bạn: ☐ đúng ☐ sai ☐ không làm được (ghi lại: )\n- Case: \`${id}\` (${c.mode}, ${c.strategy})\n`;
  };
  return `---
type: note
---
# Hướng dẫn thử

Vault này sinh bằng \`otf generate --preset kg-solo --ui\`. Dùng để thử hai cách dùng trong docs/knowledge-graph/usage.md: **cách 1** dạo theo không gian (breadcrumb, ExcaliBrain) và **cách 2** gõ từ khoá rồi xem trang tổng hợp (Bases nhúng). Mọi đáp án là kết quả của engine tham chiếu, tính tại ngày 2026-10-15.

## Cài đặt (một lần)

1. Obsidian 1.15 trở lên. Settings, Community plugins, tắt Restricted mode.
2. Cài và bật: **Breadcrumbs** (4.22.1 trở lên), **Dataview**, **Excalidraw**, **ExcaliBrain**. Cấu hình đã nằm sẵn trong \`.obsidian/plugins/\`; vault không chứa code plugin.
3. Core plugin **Bases** đã bật sẵn. Nếu panel Breadcrumbs trống: lệnh "Breadcrumbs: Rebuild graph".
4. Điện thoại: chép cả thư mục vault (kể cả \`.obsidian\`) sang máy, cài lại bốn plugin trên máy đó.

## Cách 1: dạo theo không gian

${way1.map(row).join('\n')}
## Cách 2: gõ từ khoá, xem trang tổng hợp

${way2.map(row).join('\n')}
## Việc nên để ý (ghi lại khi test, mục E9.7)

- \`conditions\` nằm trong note claim (\`cause\`, \`effect\`), không phải khoá trên note yếu tố: Breadcrumbs không thấy cạnh nào loại này dù đã khai báo.
- Alias: Obsidian không nối liên kết ghi bằng tên ABC Corp với Công ty ABC trong view \`file.hasLink\`; xem bài 2.
- Trên điện thoại: Breadcrumbs (bug #799), ExcaliBrain, Bases nhúng có hiện không? Ghi từng cái vào bảng dưới.

| Thứ | Máy | Điện thoại | Ghi chú |
|---|---|---|---|
| Breadcrumbs trail | | | |
| Breadcrumbs matrix | | | |
| ExcaliBrain | | | |
| Bases nhúng trong trang khách hàng | | | |
| Quick Switcher qua alias | | | |
`;
}
