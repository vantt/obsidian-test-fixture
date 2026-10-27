// Link graph export, built on truth.mjs (same parser, same resolution rules).
import fs from 'node:fs';
import path from 'node:path';
import { excludedLinks, fmList, openVault, parse, scanLinks } from './truth.mjs';
import { MANIFEST } from './hash.mjs';

const TAG_RE = /(^|[\s(])#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu;

const readManifest = (vault) => {
  try { return JSON.parse(fs.readFileSync(path.join(vault, MANIFEST), 'utf8')); } catch { return null; }
};

// Frontmatter key that holds the link on frontmatter line i (0-based): the nearest top-level `key:` at or above it.
// This is the relation name of a typed edge (`uses: ["[[Webflow]]"]` -> key "uses").
const keyAt = (fmLines, i) => {
  for (let k = Math.min(i, fmLines.length - 1); k >= 0; k--) { const m = fmLines[k].match(/^([^\s#:-][^:]*):/); if (m) return m[1].trim(); }
  return null;
};

export function buildGraph(vault, { otfVersion } = {}) {
  const v = openVault(vault);
  const manifest = readManifest(vault);
  const nodes = [], edges = [], excluded = [], unresolved = [];
  for (const p of v.all) {
    const from = v.rel(p);
    const parsed = parse(v.read(p));
    const { fm, body, start } = parsed;
    const tags = new Set(fm ? fmList(fm, 'tags') || [] : []);
    for (const l of body) for (const m of l.matchAll(TAG_RE)) tags.add(m[2]);
    nodes.push({
      id: from,
      title: path.posix.basename(from, '.md'),
      aliases: fm ? fmList(fm, 'aliases') || [] : [],
      tags: [...tags].sort(),
      folder: path.posix.dirname(from) === '.' ? '' : path.posix.dirname(from),
    });
    const fmLines = fm ? fm.split('\n') : [];
    for (const l of scanLinks(body, fm, start)) {
      const to = v.resolve(l.target, from);
      const edge = { from, to, kind: l.form, target: l.target + l.sub, line: l.line, resolved: to !== null };
      if (l.form === 'frontmatter') edge.key = keyAt(fmLines, l.line - 2);
      edges.push(edge);
      if (l.kind === 'wiki' && to === null) unresolved.push({ from, target: l.target });
    }
    for (const x of excludedLinks(parsed)) excluded.push({ from, raw: x.raw, reason: x.reason, line: x.line });
  }
  return {
    version: 1,
    generator: { preset: manifest?.preset ?? null, seed: manifest?.options?.seed ?? null, otfVersion: manifest?.version ?? otfVersion ?? null },
    nodes, edges, excluded, unresolved,
  };
}
