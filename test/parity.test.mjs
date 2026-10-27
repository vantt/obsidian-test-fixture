// Tree hashes and truth outputs recorded from obsidian-agentkit's scripts before the port (test/fixtures/parity.json).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { format, truth } from '../lib/truth.mjs';
import { treeHash } from '../lib/hash.mjs';
import { generate } from '../lib/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { names, parity, vault } from './helpers.mjs';

for (const name of names) {
  test(`tree hash: ${name}`, () => assert.equal(treeHash(vault(name)), parity[name].treeHash));
  test(`truth outputs: ${name}`, async () => {
    for (const t of parity[name].truth) {
      const out = format(await truth(t.args[0], vault(name), t.args.slice(1))) + '\n';
      assert.equal(createHash('sha256').update(out).digest('hex'), t.sha256, t.args.join(' '));
      if (t.out) assert.equal(out, t.out);
    }
  });
}

test('same preset and seed twice: identical tree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otf-'));
  const a = generate({ preset: 'personal-vault', out: path.join(dir, 'a'), options: { seed: 7 } });
  const b = generate({ preset: 'personal-vault', out: path.join(dir, 'b'), options: { seed: 7 } });
  assert.equal(a.treeHash, b.treeHash);
});

test('different seed changes the output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otf-'));
  const a = generate({ preset: 'personal-vault', out: path.join(dir, 'a'), options: { seed: 8 } });
  assert.notEqual(a.treeHash, parity['personal-vault-seed7'].treeHash);
});

test('long note is CRLF and file names are NFC', () => {
  const v = vault('hard-cases');
  assert.ok(fs.readFileSync(path.join(v, 'long/Long CRLF Note.md'), 'utf8').includes('\r\n'));
  for (const d of fs.readdirSync(v)) assert.equal(d, d.normalize('NFC'));
});

test('lab-dir and marker options keep parity defaults, rename when set', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otf-'));
  generate({ preset: 'personal-vault', out: path.join(dir, 'x'), options: { labDir: 'lab', marker: '.m' } });
  assert.ok(fs.existsSync(path.join(dir, 'x/lab/Target Note.md')));
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'x/.m'), 'utf8'));
  assert.deepEqual(Object.keys(m), ['about', 'generator', 'seed', 's6']);
  assert.ok(m.s6.passing.includes('lab/tiếng việt/Ghi chú tiếng Việt.md'));
});

test('answers-out moves the key out of the vault, marker keeps only a flag', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otf-'));
  const key = path.join(dir, 'state', 'answer-key.json');
  const r = generate({ preset: 'personal-vault', out: path.join(dir, 'x'), options: { answersOut: key } });
  assert.deepEqual(r.outside, [key]);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'x/.e8-synthetic'), 'utf8'));
  assert.deepEqual(m, { synthetic: true, generator: 'tests/models/gen-synth-vault.mjs', seed: 7 });
  // The key is exactly what the default marker holds.
  assert.equal(fs.readFileSync(key, 'utf8'), fs.readFileSync(path.join(vault('personal-vault-seed7'), '.e8-synthetic'), 'utf8'));
  // Nothing in the vault, manifest included, says where the key went.
  const manifest = fs.readFileSync(path.join(dir, 'x/.fixture-manifest.json'), 'utf8');
  assert.equal(JSON.parse(manifest).options.answersOut, true);
  assert.ok(!manifest.includes(key));
  assert.notEqual(r.treeHash, parity['personal-vault-seed7'].treeHash);
});

test('answers-out inside the vault is refused; default manifest has no answersOut', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otf-'));
  assert.throws(() => generate({ preset: 'personal-vault', out: path.join(dir, 'x'), options: { answersOut: path.join(dir, 'x/key.json') } }), /^Error: refusing:/);
  assert.ok(!fs.existsSync(path.join(dir, 'x')));
  const m = JSON.parse(fs.readFileSync(path.join(vault('personal-vault-seed7'), '.fixture-manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(m.options), ['seed', 'labDir', 'marker']);
});
