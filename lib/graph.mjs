// Link graph export, built on truth.mjs (same parser, same resolution rules).
import fs from 'node:fs';
import path from 'node:path';
import { excludedLinks, fmList, openVault, parse, scanLinks } from './truth.mjs';
import { MANIFEST } from './hash.mjs';

const TAG_RE = /(^|[\s(])#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu;

const readManifest = (vault) => {
  try { return JSON.parse(fs.readFileSync(path.join(vault, MANIFEST), 'utf8')); } catch { return null; }
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
    for (const l of scanLinks(body, fm, start)) {
      const to = v.resolve(l.target, from);
      edges.push({ from, to, kind: l.form, target: l.target + l.sub, line: l.line, resolved: to !== null });
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
