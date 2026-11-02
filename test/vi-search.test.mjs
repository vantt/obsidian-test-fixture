import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { generate } from '../lib/index.mjs';
import { categories, strip, telex, typo } from '../presets/vi-search.mjs';
import { tmpDir } from './helpers.mjs';

const make = (options = {}) => {
  const dir = tmpDir('otf-vi-');
  const out = path.join(dir, 'v');
  const goldenFile = path.join(dir, 'golden.json');
  generate({ preset: 'vi-search', out, options: { ...options, answersOut: goldenFile } });
  return { out, golden: JSON.parse(fs.readFileSync(goldenFile, 'utf8')) };
};

test('golden set: 17 categories x 15 queries, eval format, unique ids', () => {
  const { golden } = make();
  assert.equal(categories.length, 17);
  assert.equal(golden.length, 255);
  assert.equal(new Set(golden.map((q) => q.id)).size, 255);
  for (const c of categories) assert.equal(golden.filter((q) => q.category === c).length, 15, c);
  for (const q of golden) {
    assert.deepEqual(Object.keys(q).slice(0, 6), ['id', 'query', 'relevant_paths', 'partial_paths', 'category', 'notes']);
    assert.ok(q.query.length > 0 && q.relevant_paths.length === 1, q.id);
  }
});

test('every relevant path exists, names are NFC, golden does not depend on the seed', () => {
  const a = make();
  const b = make({ seed: 99 });
  assert.deepEqual(a.golden, b.golden);
  for (const q of a.golden) for (const p of q.relevant_paths) {
    assert.ok(fs.existsSync(path.join(a.out, p)), p);
    assert.equal(p, p.normalize('NFC'));
  }
});

test('lexicon has the three sections and the unused proposals section', () => {
  const { out } = make();
  const text = fs.readFileSync(path.join(out, '_ohs/lexicon.md'), 'utf8');
  const heads = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(heads, ['Đồng nghĩa', 'Viết tắt', 'Từ ghép', 'Chờ duyệt']);
  assert.match(text, /^KH = khách hàng$/m);
});

test('same seed twice gives the same tree; the golden set is not in the vault', () => {
  const dir = tmpDir('otf-vi-');
  const a = generate({ preset: 'vi-search', out: path.join(dir, 'a') });
  const b = generate({ preset: 'vi-search', out: path.join(dir, 'b') });
  assert.equal(a.treeHash, b.treeHash);
  assert.ok(!fs.readdirSync(path.join(dir, 'a'), { recursive: true }).some((f) => /golden/.test(String(f))));
});

test('query transforms', () => {
  assert.equal(strip('Đường đi bộ ven sông'), 'Duong di bo ven song');
  assert.equal(telex('tiếng việt'), 'tieengs vieetj');
  assert.equal(telex('giữ chân khách hàng'), 'giuwx chaan khachs hangf');
  assert.equal(typo('khách hàng'), 'khahc hagn');
});

test('no e-mail addresses or home paths in generated text', () => {
  const { out } = make();
  for (const f of fs.readdirSync(out, { recursive: true, withFileTypes: true })) {
    if (!f.isFile()) continue;
    const text = fs.readFileSync(path.join(f.parentPath, f.name), 'utf8');
    assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\/home\/|\/Users\//, f.name);
  }
});
