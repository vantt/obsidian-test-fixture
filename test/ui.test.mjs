// kg-solo --ui: the config files are valid and agree with the schema, embedded views point at real bases and
// views, the guide's answers are the answer key's, and everything else (tree, cases) is unchanged.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { generate } from '../lib/index.mjs';
import { loadKg, readVault, runQuery } from '../lib/kg.mjs';
import { load, CORE_SCHEMA } from '../vendor/js-yaml.mjs';
import { BC_FIELDS, BC_GROUPS, EXCALIBRAIN_HIERARCHY } from '../presets/kg-solo-ui.mjs';
import { schema } from '../presets/kg-solo.mjs';

const make = (options) => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'otf-ui-')), 'v');
  generate({ preset: 'kg-solo', out, options });
  return out;
};
const walk = (root, dir = '', acc = new Map()) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(root, rel, acc); else acc.set(rel, fs.readFileSync(path.join(root, rel), 'utf8'));
  }
  return acc;
};
const OPTS = { clients: 5, days: 30 };
const plain = make(OPTS), ui = make({ ...OPTS, ui: true });
const P = walk(plain), U = walk(ui);
const json = (f) => JSON.parse(U.get(f));
const key = json('.kg-answers.json');

test('without --ui nothing of the UI layer is written', () => {
  assert.ok(![...P.keys()].some((f) => f.startsWith('Bases/') || f.startsWith('.obsidian/') || f === 'Hướng dẫn thử.md'));
  assert.equal(JSON.parse(P.get('.kg-answers.json')).stats.notes + 1, key.stats.notes);
});

test('--ui only adds files and appends embeds to client, project and factor notes', () => {
  const kgP = loadKg(readVault(plain), schema);
  const added = [...U.keys()].filter((f) => !P.has(f)).sort();
  assert.deepEqual(added.filter((f) => !f.startsWith('Bases/')), ['.obsidian/app.json', '.obsidian/core-plugins.json', '.obsidian/plugins/breadcrumbs/data.json', '.obsidian/plugins/excalibrain/data.json', '.obsidian/plugins/labelled-links/data.json', '.obsidian/types.json', 'Hướng dẫn thử.md']);
  assert.deepEqual(added.filter((f) => f.startsWith('Bases/')), ['Bases/Claim theo yếu tố.base', 'Bases/Dự án.base', 'Bases/Hợp đồng đang chạy.base', 'Bases/Đầu mối hiện tại.base', 'Bases/Đề xuất LLM chờ duyệt.base']);
  for (const [f, text] of P) {
    if (f === '.kg-answers.json' || f === '.fixture-manifest.json') continue;
    if (text === U.get(f)) continue;
    assert.ok(['organization', 'project', 'factor'].includes(kgP.notes.get(f).type), f);
    assert.ok(U.get(f).startsWith(text) && U.get(f).includes('![[Bases/'), f);
  }
});

test('--ui keeps the answer key: same cases and answers, only stats count the guide note', () => {
  const k0 = JSON.parse(P.get('.kg-answers.json'));
  assert.deepEqual(key.cases, k0.cases);
  assert.deepEqual(key.schema, k0.schema);
  assert.equal(key.stats.byType.note, k0.stats.byType.note + 1);
  const kg = loadKg(readVault(ui), key.schema);
  for (const c of key.cases) assert.deepEqual(c.query ? runQuery(kg, c.query) : c.queries.map((q) => runQuery(kg, q)), c.expect, c.id);
  assert.equal(runQuery(kg, { op: 'validate' }).length, 12);
});

test('same options twice: identical --ui tree', () => {
  assert.deepEqual([...walk(make({ ...OPTS, ui: true }))], [...U]);
});

test('bases are valid YAML with the documented keys, and every filter and column is well formed', () => {
  const bases = [...U].filter(([f]) => f.endsWith('.base'));
  assert.equal(bases.length, 5);
  for (const [f, text] of bases) {
    const b = load(text, { schema: CORE_SCHEMA });
    assert.deepEqual(Object.keys(b).filter((k) => !['filters', 'formulas', 'properties', 'summaries', 'views'].includes(k)), [], f);
    assert.ok(b.views.length >= 1, f);
    for (const v of b.views) {
      assert.equal(v.type, 'table', f);
      assert.ok(v.name && Array.isArray(v.order) && v.order.length, `${f}: ${v.name}`);
      for (const s of v.filters?.and ?? []) assert.equal(typeof s, 'string');
      for (const o of v.order.filter((x) => x.startsWith('formula.'))) assert.ok(b.formulas?.[o.slice(8)], o);
    }
    // Measured on Obsidian 1.15.0: `!prop` on a missing property matches nothing; isEmpty() works.
    assert.ok(!/!\s*[a-z_]+\s*(\|\||\)|$)/m.test(text), `${f}: negation of a bare property`);
    // A view that uses `this` must be the page view, and the page view must use it.
    for (const v of b.views) assert.equal(JSON.stringify(v).includes('this.file'), v.name === 'Của trang này', `${f}: ${v.name}`);
  }
});

test('every embed names an existing base and view; clients, projects and factors all have one', () => {
  const views = new Map([...U].filter(([f]) => f.endsWith('.base')).map(([f, t]) => [f, load(t, { schema: CORE_SCHEMA }).views.map((v) => v.name)]));
  const kg = loadKg(readVault(ui), key.schema);
  const seen = new Set();
  for (const [f, text] of U) {
    if (!f.endsWith('.md')) continue;
    const embeds = [...text.matchAll(/!\[\[([^\]#]+\.base)#([^\]]+)\]\]/g)];
    for (const [, base, view] of embeds) assert.ok(views.get(base)?.includes(view), `${f}: ${base}#${view}`);
    if (['organization', 'project', 'factor'].includes(kg.notes.get(f).type)) { assert.ok(embeds.length, f); seen.add(kg.notes.get(f).type); }
    else assert.equal(embeds.length, 0, f);
  }
  assert.equal(seen.size, 3);
});

test('Breadcrumbs data.json: groups use declared fields, every field has its opposite implied, fields are schema edges', () => {
  const bc = json('.obsidian/plugins/breadcrumbs/data.json');
  const labels = bc.edge_fields.map((x) => x.label);
  assert.deepEqual(labels, BC_FIELDS);
  for (const g of bc.edge_field_groups) for (const f of g.fields) assert.ok(labels.includes(f), `${g.label}: ${f}`);
  assert.deepEqual(bc.edge_field_groups, BC_GROUPS);
  for (const need of ['up', 'parent_moc', 'part_of', 'conditions']) assert.ok(labels.includes(need), need);
  const closes = new Set(bc.implied_relations.transitive.map((r) => `${r.chain[0].field}>${r.close_field}`));
  for (const [f, def] of Object.entries(schema.edges)) {
    if (!labels.includes(f)) continue;
    if (def.symmetric) assert.ok(closes.has(`${f}>${f}`), f);
    else { assert.ok(labels.includes(def.inverse), f); assert.ok(closes.has(`${f}>${def.inverse}`) && closes.has(`${def.inverse}>${f}`), f); }
  }
  for (const r of bc.implied_relations.transitive) assert.ok(r.close_reversed && labels.includes(r.close_field) && labels.includes(r.chain[0].field));
});

test('Breadcrumbs matrix lists every group; Labelled Links registry has one pair per schema edge', () => {
  const bc = json('.obsidian/plugins/breadcrumbs/data.json');
  assert.deepEqual(bc.views.side.matrix.field_group_labels, bc.edge_field_groups.map((g) => g.label));
  const defs = json('.obsidian/plugins/labelled-links/data.json').relationDefinitions;
  assert.deepEqual(defs, Object.entries(schema.edges).map(([k, e]) => `${k} <-> ${e.inverse}`));
  assert.ok(defs.includes('uses <-> used_by') && defs.includes('client <-> has_project') && defs.includes('related <-> related'));
});

test('ExcaliBrain data.json: hierarchy is complete and its fields come from the schema or their inverses', () => {
  const h = json('.obsidian/plugins/excalibrain/data.json').hierarchy;
  assert.deepEqual(Object.keys(h).sort(), ['children', 'exclusions', 'hidden', 'leftFriends', 'next', 'parents', 'previous', 'rightFriends']);
  assert.deepEqual(h, EXCALIBRAIN_HIERARCHY);
  const known = new Set(Object.entries(schema.edges).flatMap(([k, e]) => [k, e.inverse]));
  for (const k of ['parents', 'children', 'leftFriends', 'previous', 'next']) for (const f of h[k]) assert.ok(known.has(f), `${k}: ${f}`);
  for (const f of h.parents) assert.ok(h.children.includes(schema.edges[f].inverse), f);
});

test('Obsidian config: Bases core plugin on, property types for the dates the bases compare', () => {
  assert.equal(json('.obsidian/core-plugins.json').bases, true);
  const t = json('.obsidian/types.json').types;
  for (const k of ['valid_from', 'valid_to', 'start']) assert.equal(t[k], 'date');
  assert.ok(![...U.keys()].some((f) => /\.(js|css)$/.test(f)), 'no plugin code in the vault');
});

test('guide: every exercise quotes its case id and that case\'s answer; hand-checked answers', () => {
  const g = U.get('Hướng dẫn thử.md');
  assert.match(g, /^---\ntype: note\n---\n/);
  const ids = [...g.matchAll(/^- Case: `([^`]+)` \((\w+), ([\w-]+)\)$/gm)];
  assert.ok(ids.length >= 10);
  for (const [, id, mode, strategy] of ids) {
    const c = key.cases.find((x) => x.id === id);
    assert.ok(c, id);
    assert.deepEqual([c.mode, c.strategy], [mode, strategy], id);
    assert.ok(['navigate', 'search', 'push'].includes(mode), id);
    assert.ok(g.includes(`### ${c.question.replace(/^/, '')}`.slice(4)), id);
  }
  assert.ok(ids.filter((m) => m[2] === 'navigate').length >= 5 && ids.filter((m) => m[2] === 'search').length >= 4);
  const answer = (id) => g.split(`- Case: \`${id}\``)[0].split('- Đáp án: ').pop().split('\n')[0];
  assert.equal(answer('time-contact-now'), 'contact: Trần Thị Bình');
  assert.equal(answer('time-price-now'), 'Bảng giá 2026');
  assert.equal(answer('nav-up-not-moc'), 'Dashboard; Phân tích dữ liệu');
  assert.equal(answer('identity-alias'), 'Công ty ABC');
  assert.equal(answer('llm-pending'), 'LinkedIn là điều kiện có lead; Nhiều việc làm chậm phản hồi');
});

test('CLI: --ui flag writes the UI layer', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'otf-ui-')), 'v');
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../bin/otf.mjs', import.meta.url)), 'generate', '--preset', 'kg-solo', '--ui', '--clients', '2', '--days', '10', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(out, 'Bases/Dự án.base')));
});
