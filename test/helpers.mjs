import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generate } from '../lib/index.mjs';

export const parity = JSON.parse(fs.readFileSync(new URL('./fixtures/parity.json', import.meta.url), 'utf8'));

const PRESET = { 'hard-cases': 'hard-cases', 'hard-cases-standalone': 'hard-cases', 'hard-cases-bulk200': 'hard-cases', 'personal-vault-seed7': 'personal-vault', 'kg-solo': 'kg-solo', 'kg-solo-ui': 'kg-solo' };
const OPTS = { 'hard-cases': {}, 'hard-cases-standalone': { standalone: true }, 'hard-cases-bulk200': { bulk: 200 }, 'personal-vault-seed7': { seed: 7 }, 'kg-solo': {}, 'kg-solo-ui': { ui: true } };

const made = [];
process.on('exit', () => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
// temp dir owned by this test process; removed on exit, nothing else in os.tmpdir() is touched
export function tmpDir(prefix = 'otf-') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(d);
  return d;
}

const cache = new Map();
export function vault(name) {
  if (!cache.has(name)) {
    const out = path.join(tmpDir(), 'v');
    generate({ preset: PRESET[name], out, options: OPTS[name] });
    cache.set(name, out);
  }
  return cache.get(name);
}
export const names = Object.keys(PRESET);
