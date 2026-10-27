// Ground truth from files alone (no Obsidian). Port of obsidian-agentkit tests/ground-truth/gt.mjs:
// same rules, same output. The graph export (graph.mjs) is built on the parser and resolver here.
//   tasks [folder]           open/done task counts (outside code blocks)
//   backlinks <notePath>     files linking to note (wikilink, embed, heading, block, md link)
//   unresolved [folder]      wikilink targets that match no file name or alias-free path
//   tags <tag> [folder]      occurrences of #tag (body, outside code) and in frontmatter tags
//   yaml <notePath>          frontmatter parses; prints keys and JS types (vendored js-yaml)
//   crlf <notePath>          line count and line-ending mix
import fs from 'node:fs';
import path from 'node:path';

export const COMMANDS = ['tasks', 'backlinks', 'unresolved', 'tags', 'yaml', 'crlf'];

export class UsageError extends Error {}

const WIKI_RE = /(!?)\[\[([^\]|#^]*)((?:[#^][^\]|]*)?)(?:\|[^\]]*)?\]\]/g;
const MD_RE = /\[[^\]]*\]\(([^)\s]+?\.md)(?:#[^)]*)?\)/g;

// Split note into frontmatter text and body lines with code (fenced and inline) blanked out.
// `raw` keeps the original body lines and `code[i]` says why line i was blanked, for the graph's `excluded` list.
export function parse(text) {
  const lines = text.split(/\r?\n/);
  let fm = null;
  let start = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) { fm = lines.slice(1, end).join('\n'); start = end + 1; }
  }
  const body = [], raw = [], code = [];
  let fence = null;
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^\s*(`{3,}|~{3,})/);
    raw.push(l);
    if (fence) { if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null; body.push(''); code.push(true); continue; }
    if (m) { fence = m[1]; body.push(''); code.push(true); continue; }
    code.push(false);
    body.push(l.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length)));
  }
  return { fm, body, start, raw, code };
}

// Links in a note: [[target#sub|alias]], ![[...]], [text](url.md), in the body and in frontmatter.
// Wikilinks come first, then markdown links, as before. Each link carries its file line and kind.
export function scanLinks(bodyLines, fm, start = 0) {
  const out = [];
  const text = bodyLines.join('\n') + '\n' + (fm || '');
  const bodyLen = bodyLines.join('\n').length + 1;
  const lineAt = (idx) => {
    if (idx < bodyLen) return start + text.slice(0, idx).split('\n').length;
    return 2 + text.slice(bodyLen, idx).split('\n').length - 1;
  };
  for (const m of text.matchAll(WIKI_RE)) {
    const sub = m[3] || '';
    const form = m[1] ? 'embed' : sub.startsWith('#^') ? 'block' : sub.startsWith('#') ? 'heading' : 'wikilink';
    out.push({ kind: 'wiki', target: m[2].trim(), form: m.index >= bodyLen ? 'frontmatter' : form, raw: m[0], sub, line: lineAt(m.index) });
  }
  for (const m of text.matchAll(MD_RE)) {
    if (/^[a-z]+:\/\//i.test(m[1])) continue;
    out.push({ kind: 'md', target: decodeURIComponent(m[1]), form: m.index >= bodyLen ? 'frontmatter' : 'markdown', raw: m[0], sub: '', line: lineAt(m.index) });
  }
  return out;
}

// Links that sit inside code and are therefore not counted, with the reason.
export function excludedLinks(parsed) {
  const out = [];
  parsed.raw.forEach((line, i) => {
    const bodyLine = parsed.body[i];
    const found = [];
    for (const m of line.matchAll(WIKI_RE)) found.push({ raw: m[0], index: m.index });
    for (const m of line.matchAll(MD_RE)) if (!/^[a-z]+:\/\//i.test(m[1])) found.push({ raw: m[0], index: m.index });
    for (const f of found) {
      if (parsed.code[i]) out.push({ raw: f.raw, reason: 'code-block', line: parsed.start + i + 1 });
      else if (bodyLine.slice(f.index, f.index + f.raw.length) !== f.raw) out.push({ raw: f.raw, reason: 'inline-code', line: parsed.start + i + 1 });
    }
  });
  return out;
}

export const links = (bodyLines, fm) => scanLinks(bodyLines, fm).map(({ kind, target }) => ({ kind, target }));

// Values of a frontmatter list key (inline `[a, b]` or an indented `- x` block).
export function fmList(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return null;
  const inline = m[1].replace(/[\[\]]/g, '').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
  // block list: indented "- x" lines right after the key, stopping at the next key
  const after = fm.slice(m.index + m[0].length).split('\n').slice(1);
  const items = [];
  for (const l of after) { const x = l.match(/^\s+-\s+(.+)$/); if (!x) break; items.push(x[1].trim().replace(/^#|["']/g, '')); }
  return [...inline, ...(m[1] ? [] : items)];
}

export function openVault(vault) {
  function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue; // .obsidian, .trash, .git: not indexed by Obsidian
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else out.push(p);
    }
    return out;
  }
  const rel = (p) => path.relative(vault, p).split(path.sep).join('/');
  const notes = (folder = '') => walk(path.join(vault, folder)).filter((p) => p.endsWith('.md'));
  const read = (p) => fs.readFileSync(p, 'utf8');

  const all = notes();
  const byBase = new Map();
  for (const p of all) {
    const b = path.basename(p, '.md').toLowerCase();
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(rel(p));
  }
  const files = new Set(walk(vault).map(rel));

  // Resolve like Obsidian: exact vault path, then path relative to source, then unique-ish basename.
  // Alias names are not resolved: Obsidian does not resolve links through aliases (FINDINGS F4e).
  function resolve(target, fromRel) {
    if (!target) return fromRel; // [[#heading]] links to self
    const t = target.replace(/\\/g, '/');
    const cands = [t, t + '.md', path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), t))];
    for (const c of cands) if (files.has(c)) return c;
    if (t.includes('/')) {
      const tail = (t.endsWith('.md') ? t : t + '.md').toLowerCase();
      const hit = [...files].find((f) => f.toLowerCase().endsWith('/' + tail) || f.toLowerCase() === tail);
      if (hit) return hit;
    }
    const hits = byBase.get(path.posix.basename(t, '.md').toLowerCase());
    if (hits) return hits.sort((a, b) => a.split('/').length - b.split('/').length)[0];
    // non-md attachments by basename
    const att = [...files].find((f) => path.posix.basename(f).toLowerCase() === path.posix.basename(t).toLowerCase());
    return att || null;
  }

  return { vault, all, files, rel, notes, read, resolve };
}

export async function truth(cmd, vault, rest = []) {
  if (!COMMANDS.includes(cmd)) throw new UsageError(`unknown command: ${cmd}`);
  const { all, rel, notes, read, resolve } = openVault(vault);
  const res = {};
  switch (cmd) {
    case 'tasks': {
      let open = 0, done = 0, other = 0, inFiles = 0;
      for (const p of notes(rest[0] || '')) {
        const { body } = parse(read(p));
        let n = 0;
        for (const l of body) {
          const m = l.match(/^\s*(?:[-*+]|\d+[.)])\s+\[(.)\]/);
          if (!m) continue;
          n++;
          if (m[1] === ' ') open++; else if (m[1] === 'x' || m[1] === 'X') done++; else other++;
        }
        if (n) inFiles++;
      }
      Object.assign(res, { open, done, other, total: open + done + other, files: inFiles });
      break;
    }
    case 'backlinks': {
      const target = rest[0];
      if (target === undefined) throw new UsageError('backlinks needs a note path');
      const refs = [];
      for (const p of all) {
        const r = rel(p);
        if (r === target) continue;
        const { fm, body } = parse(read(p));
        const n = links(body, fm).filter((l) => resolve(l.target, r) === target).length;
        if (n) refs.push({ file: r, count: n });
      }
      Object.assign(res, { target, total: refs.length, files: refs.sort((a, b) => a.file.localeCompare(b.file)) });
      break;
    }
    case 'unresolved': {
      const out = [];
      for (const p of notes(rest[0] || '')) {
        const r = rel(p);
        const { fm, body } = parse(read(p));
        for (const l of links(body, fm)) if (l.kind === 'wiki' && !resolve(l.target, r)) out.push({ file: r, target: l.target });
      }
      Object.assign(res, { total: out.length, targets: new Set(out.map((o) => o.target)).size, links: out });
      break;
    }
    case 'tags': {
      if (rest[0] === undefined) throw new UsageError('tags needs a tag');
      const tag = rest[0].replace(/^#/, '');
      const re = new RegExp(`(^|[\\s(])#${tag.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,.;:!?)\\]])`, 'g');
      const body = [], front = [];
      for (const p of notes(rest[1] || '')) {
        const { fm, body: b, start } = parse(read(p));
        b.forEach((l, i) => { for (const _ of l.matchAll(re)) body.push(`${rel(p)}:${start + i + 1}`); });
        if (fm) {
          const list = fmList(fm, 'tags');
          if (list && list.includes(tag)) front.push(rel(p));
        }
      }
      Object.assign(res, { tag, body: body.length, frontmatter: front.length, bodyAt: body, frontmatterIn: front });
      break;
    }
    case 'yaml': {
      if (rest[0] === undefined) throw new UsageError('yaml needs a note path');
      const { load, CORE_SCHEMA } = await import('../vendor/js-yaml.mjs');
      const parseYaml = (t) => load(t, { schema: CORE_SCHEMA }); // CORE_SCHEMA: no timestamp type, dates stay strings
      const { fm } = parse(read(path.join(vault, rest[0])));
      try {
        const obj = fm === null ? {} : parseYaml(fm) ?? {};
        res.valid = true;
        res.keys = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Array.isArray(v) ? 'list' : v instanceof Date ? 'date' : typeof v]));
        res.values = obj;
      } catch (e) {
        Object.assign(res, { valid: false, error: String(e.message).split('\n')[0] });
      }
      break;
    }
    case 'crlf': {
      if (rest[0] === undefined) throw new UsageError('crlf needs a note path');
      const t = read(path.join(vault, rest[0]));
      const crlf = (t.match(/\r\n/g) || []).length;
      const lf = (t.match(/\n/g) || []).length - crlf;
      Object.assign(res, { lines: crlf + lf, crlf, lf, mixed: crlf > 0 && lf > 0 });
      break;
    }
  }
  return res;
}

export const format = (res) => JSON.stringify(res, null, 1);
