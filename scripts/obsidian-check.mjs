// Checks a kg-solo --ui vault inside a running Obsidian (1.15+, CLI enabled) with Breadcrumbs, Labelled Links,
// ExcaliBrain, Dataview and Excalidraw installed: our settings are kept, Breadcrumbs' graph holds every typed edge of
// the reference engine and its inverse, ExcaliBrain loads our hierarchy, the Labelled Links pane lists every engine
// neighbour (an alias link shows under its alias: known, BT4), the embedded views on the ABC page count 1/1/1, no
// errors. <fresh-generated-dir> is the same vault generated again elsewhere (settings to compare with).
// Machine-specific (uses the `obsidian` CLI); not part of `npm test`. Run scripts/obsidian-bases-check.mjs too.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { loadKg, readVault, runQuery } from '../lib/kg.mjs';
const [vault, dir, gen] = process.argv.slice(2);
if (!vault || !dir || !gen) { console.error('usage: node scripts/obsidian-check.mjs <obsidian-vault-name> <vault-dir> <fresh-generated-dir>'); process.exit(2); }
const ob = (...a) => spawnSync('obsidian', [`vault=${vault}`, ...a], { encoding: 'utf8', timeout: 120000 }).stdout;
const ev = (code) => ob('eval', `code=${code}`).replace(/^=> /, '').trim();
const key = JSON.parse(fs.readFileSync(`${dir}/.kg-answers.json`, 'utf8'));
const kg = loadKg(readVault(dir), key.schema);
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, detail); };
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const title = (id) => id.replace(/^.*\//, '').replace(/\.md$/, '');

// A. settings files untouched by install
for (const f of ['breadcrumbs', 'excalibrain', 'labelled-links']) {
  const p = `.obsidian/plugins/${f}/data.json`;
  const same = sha(`${gen}/${p}`) === sha(`${dir}/${p}`);
  if (f !== 'breadcrumbs') check(`A data.json unchanged after install: ${f}`, same);
  else {
    // Breadcrumbs saves its full settings (defaults merged in): our values must be kept.
    const w = JSON.parse(fs.readFileSync(`${gen}/${p}`, 'utf8')), g = JSON.parse(fs.readFileSync(`${dir}/${p}`, 'utf8'));
    const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    check('A data.json keeps our values after install: breadcrumbs', eq(w.edge_fields, g.edge_fields) && eq(w.edge_field_groups, g.edge_field_groups) && eq(w.implied_relations.transitive, g.implied_relations.transitive) && eq(w.views.side.matrix.field_group_labels, g.views.side.matrix.field_group_labels) && eq(w.views.page.trail.field_group_labels, g.views.page.trail.field_group_labels), `file ${same ? 'identical' : 'rewritten with defaults'}`);
  }
}
// B. Breadcrumbs: settings in memory + whole-graph comparison with the engine
ev('app.plugins.plugins.breadcrumbs.rebuildGraph().then(()=>1)');
await new Promise((r) => setTimeout(r, 4000));
const bc = JSON.parse(ev('JSON.stringify({f:app.plugins.plugins.breadcrumbs.settings.edge_fields.map(x=>x.label),g:app.plugins.plugins.breadcrumbs.settings.edge_field_groups.map(x=>x.label),m:app.plugins.plugins.breadcrumbs.settings.views.side.matrix.field_group_labels})'));
const want = JSON.parse(fs.readFileSync(`${gen}/.obsidian/plugins/breadcrumbs/data.json`, 'utf8'));
check('B Breadcrumbs fields/groups/matrix labels loaded', JSON.stringify(bc.f) === JSON.stringify(want.edge_fields.map((x) => x.label)) && JSON.stringify(bc.g) === JSON.stringify(want.edge_field_groups.map((x) => x.label)) && JSON.stringify(bc.m) === JSON.stringify(bc.g), `matrix=${bc.m.length} groups=${bc.g.length}`);
const edgesRaw = ev('(()=>{const g=app.plugins.plugins.breadcrumbs.graph;const nodes=[];g.iterate_nodes(n=>{const m=/path: "([^"]*)"/.exec(n.toString());nodes.push(m&&m[1])});const out={};for(const n of nodes){const a=g.get_outgoing_edges(n).to_array().map(e=>{const s=e.toString();return /edge_type: "([^"]*)"/.exec(s)[1]+">"+nodes[+/target_index: NodeIndex\\((\\d+)\\)/.exec(s)[1]]});if(a.length)out[n]=a}return JSON.stringify(out)})()');
const bcEdges = JSON.parse(edgesRaw);
const fields = new Set(bc.f), inv = key.schema.edges;
let missing = 0, total = 0;
const has = (from, t, to) => (bcEdges[from] || []).includes(`${t}>${to}`);
for (const e of kg.edges.filter((e) => !e.claim && fields.has(e.rel))) {
  total++; if (!has(e.from, e.rel, e.to)) missing++;
  const iv = inv[e.rel].inverse; total++; if (!has(e.to, iv, e.from)) missing++;
}
check('B Breadcrumbs graph has every explicit edge and its implied inverse', missing === 0, `${total - missing}/${total}`);
const trail = (n) => { const o = []; let cur = n; for (let i = 0; i < 6; i++) { const nx = (bcEdges[cur] || []).find((x) => x.startsWith('parent_moc>')); if (!nx) break; cur = nx.slice(11); o.push(title(cur)); } return o; };
const wantTrail = runQuery(kg, key.cases.find((c) => c.id === 'browse-moc-trail').query).map(title);
check('B case browse-moc-trail', JSON.stringify(trail('MOC/MOC Dashboard ABC.md')) === JSON.stringify(wantTrail), trail('MOC/MOC Dashboard ABC.md').join(' > '));
// C. ExcaliBrain
const ex = JSON.parse(ev('JSON.stringify({l:app.plugins.plugins.excalibrain._loaded,h:app.plugins.plugins.excalibrain.settings.hierarchy})'));
const wantH = JSON.parse(fs.readFileSync(`${gen}/.obsidian/plugins/excalibrain/data.json`, 'utf8')).hierarchy;
const sorted = (h) => JSON.stringify(Object.fromEntries(Object.entries(h).map(([k, v]) => [k, [...v].sort()])));
check('C ExcaliBrain loaded with our hierarchy', ex.l && sorted(ex.h) === sorted(wantH));
// D. Labelled Links registry + pane vs engine neighbours
const reg = JSON.parse(ev('JSON.stringify(app.plugins.plugins["labelled-links"].settings?.relationDefinitions ?? null)') || 'null');
const wantReg = JSON.parse(fs.readFileSync(`${gen}/.obsidian/plugins/labelled-links/data.json`, 'utf8')).relationDefinitions;
check('D Labelled Links registry loaded (or file intact)', reg ? JSON.stringify(reg) === JSON.stringify(wantReg) : true, reg ? `${reg.length} pairs` : 'settings key not exposed; file intact');
for (const n of ['Công cụ/Metabase.md', 'Công cụ/Supabase.md', 'Dự án/Dashboard doanh thu ABC.md']) {
  ob('open', `path=${n}`);
  const pane = ev('(async()=>{let ls=app.workspace.getLeavesOfType("labelled-links-relations");if(!ls.length){const l=app.workspace.getRightLeaf(false);await l.setViewState({type:"labelled-links-relations",active:false});ls=app.workspace.getLeavesOfType("labelled-links-relations")}await new Promise(r=>setTimeout(r,2500));return ls[0].view.containerEl.innerText})()');
  const nb = runQuery(kg, { op: 'neighbors', node: n, dir: 'both', rels: Object.keys(inv) });
  const names = [...new Set(nb.filter((x) => !/Hướng dẫn/.test(x.node)).map((x) => title(x.node)))];
  const viaAlias = new Set(kg.edges.filter((e) => e.via === 'alias' && (e.from === n || e.to === n)).map((e) => title(e.from === n ? e.to : e.from)));
  const miss = names.filter((t) => !pane.includes(t) && !(viaAlias.has(t) && pane.includes('ABC Corp')));
  check(`D Labelled Links pane lists every engine neighbour: ${title(n)}`, miss.length === 0, `${names.length - miss.length}/${names.length}${viaAlias.size ? ' (alias link shown by its alias, not followed: ' + [...viaAlias] + ')' : ''}${miss.length ? ' missing ' + miss.slice(0, 3) : ''}`);
}
// E. embeds on the ABC page: one contact, one contract, projects (alias trap)
ob('open', 'path=Khách hàng/Công ty ABC.md');
await new Promise((r) => setTimeout(r, 3000));
const counts = ev('JSON.stringify([...document.querySelectorAll(".bases-embed .bases-toolbar-result-count")].map(e=>e.innerText.trim()))');
check('E embeds on Công ty ABC: contact 1, contract 1, projects 1 (alias not followed)', counts === '["1 result","1 result","1 result"]', counts);
// F. errors
const errs = ob('dev:errors');
check('F no captured errors', /No errors captured/.test(errs), errs.trim().slice(0, 120));
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAIL', results.filter(Boolean).length + '/' + results.length);
