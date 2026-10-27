import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parity } from './helpers.mjs';

const bin = fileURLToPath(new URL('../bin/otf.mjs', import.meta.url));
const otf = (...a) => spawnSync(process.execPath, [bin, ...a], { encoding: 'utf8' });
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'otf-')), 'v');

test('generate, verify, tamper, verify', () => {
  const out = tmp();
  const g = otf('generate', '--preset', 'hard-cases', '--out', out);
  assert.equal(g.status, 0, g.stderr);
  assert.ok(g.stdout.includes(parity['hard-cases'].treeHash));
  assert.equal(otf('verify', out).status, 0);
  fs.appendFileSync(path.join(out, 'Target Note.md'), 'x');
  assert.equal(otf('verify', out).status, 1);
});

test('generate refuses a non-empty --out', () => {
  const out = tmp();
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'a'), '');
  const r = otf('generate', '--preset', 'hard-cases', '--out', out);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not empty/);
});

test('generate --git makes a clean repo', () => {
  const out = tmp();
  assert.equal(otf('generate', '--preset', 'hard-cases', '--git', '--out', out).status, 0);
  const s = spawnSync('git', ['-C', out, 'status', '--porcelain'], { encoding: 'utf8' });
  assert.equal(s.stdout, '');
});

test('truth and graph through the CLI', () => {
  const out = tmp();
  otf('generate', '--preset', 'hard-cases', '--out', out);
  assert.equal(JSON.parse(otf('truth', 'backlinks', out, 'Target Note.md').stdout).total, 9);
  assert.equal(JSON.parse(otf('graph', out).stdout).unresolved.length, 2);
  const file = path.join(path.dirname(out), 'graph.json');
  assert.equal(otf('graph', out, '--out', file).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).version, 1);
});

test('bad input exits 2', () => {
  assert.equal(otf('truth', 'nope', '.').status, 2);
  assert.equal(otf('generate', '--preset', 'nope', '--out', tmp()).status, 2);
  assert.equal(otf('generate', '--preset', 'hard-cases', '--out', tmp(), '--seed').status, 2);
  assert.equal(otf('generate', '--preset', 'hard-cases', '--out', tmp(), '--marker', 'x').status, 2);
});

test('presets lists both presets', () => {
  const r = otf('presets');
  assert.match(r.stdout, /hard-cases/); assert.match(r.stdout, /personal-vault/);
});
