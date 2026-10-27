import fs from 'node:fs';
import path from 'node:path';
import { MANIFEST, treeHash } from './hash.mjs';
import { assertEmpty, gitCommit, writeFiles } from './writer.mjs';
import * as hardCases from '../presets/hard-cases.mjs';
import * as personalVault from '../presets/personal-vault.mjs';
import * as kgSolo from '../presets/kg-solo.mjs';

export { treeHash, MANIFEST } from './hash.mjs';
export { truth, openVault, parse, scanLinks } from './truth.mjs';
export { buildGraph } from './graph.mjs';

export const presets = { 'hard-cases': hardCases, 'personal-vault': personalVault, 'kg-solo': kgSolo };
export const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// Resolve options against a preset's declared defaults; unknown options are an error.
export function resolveOptions(preset, given = {}) {
  const p = presets[preset];
  if (!p) throw new Error(`unknown preset: ${preset} (have: ${Object.keys(presets).join(', ')})`);
  for (const k of Object.keys(given)) if (!(k in p.options)) throw new Error(`preset ${preset} has no option "${k}"`);
  return Object.fromEntries(Object.entries(p.options).map(([k, o]) => [k, given[k] ?? o.default]));
}

// Generate a vault into `out`. `git: true` also commits it, for any preset.
// A preset may also return `files.outside` (path -> text) for files that must not be in the vault, such as an
// answer key kept away from an agent under test. Options marked `outside` name such a path: the manifest only
// says whether one was given, never where it is.
export function generate({ preset, out, options = {}, git = false }) {
  const opts = resolveOptions(preset, options);
  const p = presets[preset];
  for (const [k, o] of Object.entries(p.options)) {
    const rel = o.outside && opts[k] ? path.relative(path.resolve(out), path.resolve(opts[k])) : '..';
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) throw new Error(`refusing: --${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())} must be outside ${out}`);
  }
  assertEmpty(out);
  const files = p.build(opts);
  writeFiles(out, files);
  for (const [file, text] of files.outside || []) { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, text); }
  const hash = treeHash(out);
  const shown = Object.fromEntries(Object.entries(opts).flatMap(([k, v]) => (p.options[k].outside ? (v ? [[k, true]] : []) : [[k, v]])));
  fs.writeFileSync(path.join(out, MANIFEST), JSON.stringify({ preset, options: shown, version, treeHash: hash, files: files.size }, null, 2) + '\n');
  if (git) gitCommit(out);
  return { files: files.size, treeHash: hash, outside: [...(files.outside || new Map()).keys()] };
}

export function verify(vault) {
  const file = path.join(vault, MANIFEST);
  if (!fs.existsSync(file)) throw new Error(`no ${MANIFEST} in ${vault}`);
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const actual = treeHash(vault);
  return { ok: actual === m.treeHash, expected: m.treeHash, actual, preset: m.preset, version: m.version };
}
