// Reference knowledge-graph engine: typed edges from frontmatter and claim notes, the R1-R10 validator, and
// the query ops that answer keys are written in. Presets run it over the files they render, so an answer key
// always says what the files say; tests check the hand-designed cases against hand-written answers.
//
// Graph model:
//   - an edge key in frontmatter (`uses: ["[[Webflow]]"]`) is an edge from the note to each target;
//   - a claim note is an edge cause -> effect (causal relations) or subject -> object (fact relations),
//     carrying the claim's status, confidence, validity window and sources;
//   - links resolve by note title, then by alias (`via: "alias"`); Obsidian itself does not resolve aliases.
import fs from 'node:fs';
import path from 'node:path';
import { CORE_SCHEMA, load } from '../vendor/js-yaml.mjs';

const LINK_RE = /\[\[([^\]|#]*)(#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

// Title and alias comparison for R8: case-, diacritic- and đ-insensitive.
export const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();

const linksIn = (v) => {
  const out = [];
  for (const x of Array.isArray(v) ? v : [v]) if (typeof x === 'string') for (const m of x.matchAll(LINK_RE)) out.push({ target: m[1].trim(), frag: m[2] || '' });
  return out;
};

export function splitNote(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { fm: {}, body: text, error: null };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { fm: {}, body: text, error: 'unclosed frontmatter' };
  try {
    const fm = load(lines.slice(1, end).join('\n'), { schema: CORE_SCHEMA }) || {};
    return { fm: typeof fm === 'object' && !Array.isArray(fm) ? fm : {}, body: lines.slice(end + 1).join('\n'), error: null };
  } catch (e) {
    return { fm: {}, body: lines.slice(end + 1).join('\n'), error: e.message.split('\n')[0] };
  }
}

// Read every .md file outside dot-folders into a Map, the same shape a preset's build() returns.
export function readVault(vault) {
  const files = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files.set(path.relative(vault, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8'));
    }
  };
  walk(vault);
  return files;
}

// Build the graph from a Map of path -> text and a schema (see presets/kg-solo.mjs for its shape).
export function loadKg(files, schema) {
  const notes = new Map();
  for (const [id, text] of files) {
    if (!id.endsWith('.md')) continue;
    const { fm, body, error } = splitNote(text);
    const aliases = Array.isArray(fm.aliases) ? fm.aliases.map(String) : [];
    notes.set(id, { id, title: path.posix.basename(id, '.md'), type: fm.type ?? null, fm, body, aliases, error });
  }
  const byTitle = new Map(), byAlias = new Map();
  for (const n of [...notes.values()].sort((a, b) => a.id.split('/').length - b.id.split('/').length || (a.id < b.id ? -1 : 1))) {
    const t = n.title.toLowerCase();
    if (!byTitle.has(t)) byTitle.set(t, n.id);
    for (const a of n.aliases) if (!byAlias.has(a.toLowerCase())) byAlias.set(a.toLowerCase(), n.id);
  }
  const resolve = (target) => {
    const t = target.toLowerCase();
    if (byTitle.has(t)) return { id: byTitle.get(t), via: 'title' };
    if (byAlias.has(t)) return { id: byAlias.get(t), via: 'alias' };
    return { id: null, via: null };
  };

  const edges = [], linkFields = [], mentions = [];
  const inverseOf = new Map([...Object.entries(schema.edges), ...Object.entries(schema.facts)].filter(([k, e]) => e.inverse !== k).map(([k, e]) => [e.inverse, k]));
  for (const n of notes.values()) {
    for (const [key, value] of Object.entries(n.fm)) {
      const ls = linksIn(value);
      if (!ls.length) continue;
      for (const l of ls) {
        const r = resolve(l.target);
        linkFields.push({ from: n.id, key, target: l.target, frag: l.frag, to: r.id, via: r.via });
        if (schema.edges[key] && r.id) edges.push({ from: n.id, rel: key, to: r.id, via: r.via, claim: null, status: 'accepted', valid_from: null, valid_to: null });
      }
    }
    if (n.type === 'claim') {
      const rel = n.fm.relation;
      const pair = schema.claimRelations[rel] === 'fact' ? ['subject', 'object'] : ['cause', 'effect'];
      const a = linksIn(n.fm[pair[0]])[0], b = linksIn(n.fm[pair[1]])[0];
      const ra = a && resolve(a.target), rb = b && resolve(b.target);
      if (ra?.id && rb?.id && schema.claimRelations[rel]) {
        edges.push({
          from: ra.id, rel, to: rb.id, via: ra.via === 'alias' || rb.via === 'alias' ? 'alias' : 'title', claim: n.id,
          status: n.fm.status ?? null, valid_from: n.fm.valid_from ?? null, valid_to: n.fm.valid_to ?? null,
        });
      }
    }
    for (const m of n.body.matchAll(LINK_RE)) {
      const r = resolve(m[1].trim());
      mentions.push({ from: n.id, target: m[1].trim(), to: r.id, via: r.via });
    }
  }
  return { schema, notes, edges, linkFields, mentions, resolve, inverseOf };
}

// --- validation (R1-R10, same numbering as the schema's rules) -------------------------------------------

export function validate(kg) {
  const { schema, notes, linkFields, edges, inverseOf } = kg;
  const out = [];
  const err = (rule, note, detail) => out.push({ rule, note, detail });
  const typeOf = (id) => notes.get(id)?.type;
  const claimFields = new Set(Object.keys(schema.claimFields));
  const typeFields = new Set(Object.values(schema.types).flatMap((t) => Object.keys(t.fields || {})));
  const rangeOk = (spec, srcType, dstType) => spec.includes('*') || spec.includes(dstType) || (spec.includes('same') && srcType === dstType);

  for (const n of notes.values()) {
    if (n.error) err('R1', n.id, `frontmatter does not parse: ${n.error}`);
    else if (!n.type || !schema.types[n.type]) err('R1', n.id, n.type ? `unknown type "${n.type}"` : 'no type');
  }
  const seenR2 = new Set();
  for (const f of linkFields) {
    const n = notes.get(f.from);
    if (inverseOf.has(f.key)) { if (!seenR2.has(f.from + f.key)) err('R5', f.from, `inverse key "${f.key}" written; write ${inverseOf.get(f.key)} on the other note`); seenR2.add(f.from + f.key); continue; }
    const known = schema.edges[f.key] || (n.type === 'claim' && claimFields.has(f.key)) || typeFields.has(f.key) || f.key === 'aliases';
    if (!known) { if (!seenR2.has(f.from + f.key)) err('R2', f.from, `key "${f.key}" holds links but is not an edge or field`); seenR2.add(f.from + f.key); continue; }
    if (!f.to) { err('R3', f.from, `${f.key}: [[${f.target}]] does not resolve`); continue; }
    if (f.to === f.from) err('R7', f.from, `${f.key} points to the note itself`);
    const e = schema.edges[f.key];
    if (e) {
      if (!e.domain.includes('*') && !e.domain.includes(n.type)) err('R4', f.from, `${f.key}: source type ${n.type} not in domain`);
      else if (!rangeOk(e.range, n.type, typeOf(f.to))) err('R4', f.from, `${f.key}: target ${f.to} has type ${typeOf(f.to)}, not in range`);
    } else if (n.type === 'claim' && schema.claimFields[f.key]?.linkTo) {
      const want = schema.claimFields[f.key].linkTo;
      if (!want.includes(typeOf(f.to))) err('R4', f.from, `${f.key}: target ${f.to} has type ${typeOf(f.to)}, want ${want.join('|')}`);
    }
  }
  // Claim cause/effect domain for the relation (causal: factor -> factor; fact relations: per schema).
  for (const e of edges) {
    if (!e.claim) continue;
    const spec = schema.edges[e.rel] || schema.facts[e.rel];
    if (!spec) continue;
    if (!spec.domain.includes(typeOf(e.from)) || !spec.range.includes(typeOf(e.to))) err('R4', e.claim, `${e.rel}: ${typeOf(e.from)} -> ${typeOf(e.to)} not allowed`);
  }
  // R6: related and up on the same pair, either direction.
  const has = (rel) => new Set(edges.filter((e) => e.rel === rel && !e.claim).flatMap((e) => [`${e.from}\0${e.to}`, `${e.to}\0${e.from}`]));
  const rel = has('related');
  for (const e of edges) if (e.rel === 'up' && rel.has(`${e.from}\0${e.to}`)) err('R6', e.from, `both up and related with ${e.to}`);
  // R8: titles and aliases unique after normalisation. One error per colliding pair, on the later note id.
  const seen = new Map();
  for (const n of [...notes.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    for (const name of new Set([n.title, ...n.aliases].map(norm))) {
      const prev = seen.get(name);
      if (prev && prev !== n.id) err('R8', n.id, `"${name}" also names ${prev}`);
      else seen.set(name, n.id);
    }
  }
  // R9 and R10 on claims.
  for (const n of notes.values()) {
    if (n.type !== 'claim') continue;
    const r = n.fm.relation, kind = schema.claimRelations[r];
    if (!kind) { err('R9', n.id, `relation "${r}" is not a claim relation`); continue; }
    const need = [...schema.claimRequired, ...(kind === 'fact' ? ['subject', 'object'] : ['cause', 'effect']), ...((schema.claimRequiredIf[r]) || [])];
    for (const k of need) if (n.fm[k] === undefined || n.fm[k] === null || n.fm[k] === '') err('R9', n.id, `missing ${k}`);
    for (const [k, f] of Object.entries(schema.claimFields)) {
      if (f.enum && n.fm[k] !== undefined && !schema.enums[f.enum].includes(String(n.fm[k]))) err('R9', n.id, `${k}: "${n.fm[k]}" not in ${f.enum}`);
    }
    if (schema.edges[r]?.humanOnly && n.fm.proposed_by === 'llm' && n.fm.status !== 'proposed') err('R10', n.id, `${r} by llm must stay proposed, is ${n.fm.status}`);
  }
  for (const e of edges) if (!e.claim && schema.edges[e.rel]?.humanOnly && notes.get(e.from).fm.proposed_by === 'llm') err('R10', e.from, `${e.rel} written by llm outside a proposed claim`);
  const key = (x) => `${x.rule.padStart(3, '0')}\0${x.note}\0${x.detail}`;
  return out.sort((a, b) => (key(a) < key(b) ? -1 : 1));
}

// --- queries --------------------------------------------------------------------------------------------

const inWindow = (e, date) => (!e.valid_from || String(e.valid_from) <= date) && (!e.valid_to || date <= String(e.valid_to));

// Edges that count for a query: claim edges by status, every edge by validity at `asOf`.
function live(kg, { rels, asOf, statuses = ['accepted', 'superseded'] }) {
  return kg.edges.filter((e) => (!rels || rels.includes(e.rel)) && (!e.claim || statuses.includes(e.status)) && (!asOf || inWindow(e, asOf)) && (e.claim || !asOf || noteLive(kg, e.from, asOf)));
}
// A note with its own validity window (contract, price list, decision) only has edges while it is valid.
const noteLive = (kg, id, date) => { const fm = kg.notes.get(id).fm; return (!fm.valid_from || String(fm.valid_from) <= date) && (!fm.valid_to || date <= String(fm.valid_to)); };

// Outgoing steps from a node; symmetric relations also step backwards; dir "in" walks against edges.
function steps(kg, es, dir) {
  const out = new Map();
  const add = (a, s) => { if (!out.has(a)) out.set(a, []); out.get(a).push(s); };
  for (const e of es) {
    const sym = kg.schema.edges[e.rel]?.symmetric;
    if (dir !== 'in' || sym) add(e.from, { rel: e.rel, to: e.to, edge: e });
    if (dir !== 'out' || sym) add(e.to, { rel: dir === 'out' || sym ? e.rel : kg.schema.edges[e.rel]?.inverse ?? kg.schema.facts[e.rel]?.inverse ?? `~${e.rel}`, to: e.from, edge: e });
  }
  return out;
}

const uniqSort = (a) => [...new Set(a)].sort();
const pathKey = (p) => `${String(p.nodes.length).padStart(4, '0')}\0${p.nodes.join('\0')}\0${p.rels.join('\0')}`;
const sign = (kg, rels) => rels.reduce((s, r) => s * (kg.schema.edges[r]?.polarity === '-' ? -1 : 1), 1);

export const ops = {
  // Typed neighbours of one note: [{rel, node}] (inverse names for incoming edges).
  neighbors(kg, { node, dir = 'both', rels, asOf, statuses }) {
    const st = steps(kg, live(kg, { rels, asOf, statuses }), dir).get(node) || [];
    return uniqSort(st.map((s) => `${s.rel}\0${s.to}`)).map((x) => { const [rel, n] = x.split('\0'); return { rel, node: n }; });
  },
  // Nodes reachable from `node` over `rels` (dir out = downstream, in = upstream), start excluded.
  reach(kg, { node, rels, dir = 'out', asOf, statuses, maxDepth = Infinity }) {
    const st = steps(kg, live(kg, { rels, asOf, statuses }), dir);
    const seen = new Set([node]);
    let frontier = [node];
    for (let d = 0; d < maxDepth && frontier.length; d++) {
      const next = [];
      for (const a of frontier) for (const s of st.get(a) || []) if (!seen.has(s.to)) { seen.add(s.to); next.push(s.to); }
      frontier = next;
    }
    seen.delete(node);
    return [...seen].sort();
  },
  // All simple directed paths from -> to of at most maxLen edges, shortest first, each with its net sign.
  paths(kg, { from, to, rels, maxLen = 6, asOf, statuses }) {
    const st = steps(kg, live(kg, { rels, asOf, statuses }), 'out');
    const out = [];
    const walk = (a, nodes, rs) => {
      if (a === to && rs.length) { out.push({ nodes: [...nodes], rels: [...rs], sign: sign(kg, rs) > 0 ? '+' : '-' }); return; }
      if (rs.length >= maxLen) return;
      for (const s of st.get(a) || []) if (!nodes.includes(s.to) || (s.to === to && to === from)) { nodes.push(s.to); rs.push(s.rel); walk(s.to, nodes, rs); nodes.pop(); rs.pop(); }
    };
    walk(from, [from], []);
    return out.sort((a, b) => (pathKey(a) < pathKey(b) ? -1 : 1));
  },
  // Simple directed cycles over `rels` of at most maxLen edges, each started at its smallest node id,
  // with the number of negative links and the loop kind (even: reinforcing, odd: balancing).
  cycles(kg, { rels, maxLen = 10, through, asOf, statuses }) {
    const st = steps(kg, live(kg, { rels, asOf, statuses }), 'out');
    const out = [];
    for (const start of [...st.keys()].sort()) {
      const walk = (a, nodes, rs) => {
        for (const s of st.get(a) || []) {
          if (s.to === start) {
            const r = [...rs, s.rel], neg = r.filter((x) => kg.schema.edges[x]?.polarity === '-').length;
            out.push({ nodes: [...nodes], rels: r, negatives: neg, kind: neg % 2 ? 'balancing' : 'reinforcing' });
          } else if (s.to > start && !nodes.includes(s.to) && rs.length + 1 < maxLen) { nodes.push(s.to); rs.push(s.rel); walk(s.to, nodes, rs); nodes.pop(); rs.pop(); }
        }
      };
      walk(start, [start], []);
    }
    return out.filter((c) => !through || c.nodes.includes(through)).sort((a, b) => (pathKey(a) < pathKey(b) ? -1 : 1));
  },
  // Follow a chain of steps from a start set; each step can have its own date. Start nodes are dropped.
  chain(kg, { start, steps: chain, exclude = [] }) {
    let cur = [start];
    for (const s of chain) cur = uniqSort(cur.flatMap((n) => ops.neighbors(kg, { node: n, dir: s.dir, rels: [s.rel], asOf: s.asOf }).map((x) => x.node)));
    return cur.filter((n) => n !== start && !exclude.includes(n));
  },
  // Sources of a claim, with the block they cite, and the notes that support or dispute it.
  provenance(kg, { claim }) {
    const sources = kg.linkFields.filter((f) => f.from === claim && f.key === 'source').map((f) => ({ note: f.to, block: f.frag.startsWith('#^') ? f.frag.slice(2) : null }));
    const by = kg.edges.filter((e) => e.to === claim && (e.rel === 'supports' || e.rel === 'disputes')).map((e) => ({ rel: e.rel, from: e.from }));
    return { sources: sources.sort((a, b) => (a.note < b.note ? -1 : 1)), evidence: by.sort((a, b) => (a.from + a.rel < b.from + b.rel ? -1 : 1)) };
  },
  // Notes matching frontmatter values, e.g. {type: 'claim', status: 'proposed', proposed_by: 'llm'}.
  select(kg, { where }) {
    return [...kg.notes.values()].filter((n) => Object.entries(where).every(([k, v]) => (k === 'type' ? n.type : n.fm[k]) === v)).map((n) => n.id).sort();
  },
  // Notes of one type that declare a validity window (valid_from, optional valid_to) containing `asOf`:
  // the current price list, the decisions in force.
  valid(kg, { type, asOf }) { return [...kg.notes.values()].filter((n) => n.type === type && n.fm.valid_from && noteLive(kg, n.id, asOf)).map((n) => n.id).sort(); },
  // Fuzzy lookup for what a person types: every word of `name` (case- and diacritic-insensitive) is a word of the
  // note's title or of one alias. Several hits mean the agent should ask, not pick.
  find(kg, { name, type }) {
    const want = norm(name).split(' ');
    const hit = (s) => { const words = new Set(norm(s).split(' ')); return want.every((w) => words.has(w)); };
    return [...kg.notes.values()].filter((n) => (!type || n.type === type) && [n.title, ...n.aliases].some(hit)).map((n) => n.id).sort();
  },
  // Which note a name points to: title first, then alias (what a KG resolver should do; Obsidian stops at title).
  resolve(kg, { name }) { return kg.resolve(name); },
  // One frontmatter value of one note.
  field(kg, { node, key }) { return kg.notes.get(node)?.fm[key] ?? null; },
  // Notes whose body links to `node` (untyped mentions, alias links included).
  mentions(kg, { node }) { return uniqSort(kg.mentions.filter((m) => m.to === node && m.from !== node).map((m) => m.from)); },
  // Groups of notes whose title or alias collide after normalisation (candidates for a merge).
  collisions(kg) {
    const by = new Map();
    for (const n of kg.notes.values()) for (const name of new Set([n.title, ...n.aliases].map(norm))) { if (!by.has(name)) by.set(name, new Set()); by.get(name).add(n.id); }
    return uniqSort([...by.values()].filter((s) => s.size > 1).map((s) => [...s].sort().join('\0'))).map((s) => s.split('\0'));
  },
  validate(kg) { return validate(kg); },
};

export function runQuery(kg, query) {
  const { op, ...args } = query;
  if (!ops[op]) throw new Error(`unknown kg op: ${op}`);
  return ops[op](kg, args);
}

// Counts for a quick sanity check of an index built elsewhere.
export function stats(kg) {
  const byType = {}, byRel = {};
  for (const n of kg.notes.values()) byType[n.type ?? '(none)'] = (byType[n.type ?? '(none)'] || 0) + 1;
  for (const e of kg.edges) byRel[e.rel] = (byRel[e.rel] || 0) + 1;
  const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { notes: kg.notes.size, edges: kg.edges.length, byType: sortObj(byType), byRel: sortObj(byRel) };
}
