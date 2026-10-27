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
