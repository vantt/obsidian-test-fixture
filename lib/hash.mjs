// Content hash over a generated tree: sha256 of "<path>\0<size>\0<sha256(content)>\n" per file,
// paths sorted by code point, '/' separators. Dot-entries named in `skip` are left out.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MANIFEST = '.fixture-manifest.json';

export function treeEntries(dir, skip = ['.git', MANIFEST]) {
  const out = [];
  const walk = (d, prefix) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!prefix && skip.includes(e.name)) continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), rel);
      else out.push(rel);
    }
  };
  walk(dir, '');
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function treeHash(dir, skip) {
  const h = createHash('sha256');
  for (const rel of treeEntries(dir, skip)) {
    const buf = fs.readFileSync(path.join(dir, rel));
    h.update(`${rel}\0${buf.length}\0${createHash('sha256').update(buf).digest('hex')}\n`);
  }
  return h.digest('hex');
}
