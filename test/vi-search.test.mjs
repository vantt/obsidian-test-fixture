import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { generate } from '../lib/index.mjs';
import { categories, queriesPer, strip, telex, typo } from '../presets/vi-search.mjs';
import { tmpDir } from './helpers.mjs';

const make = (options = {}) => {
  const dir = tmpDir('otf-vi-');
  const out = path.join(dir, 'v');
  const goldenFile = path.join(dir, 'golden.json');
  generate({ preset: 'vi-search', out, options: { ...options, answersOut: goldenFile } });
  return { out, golden: JSON.parse(fs.readFileSync(goldenFile, 'utf8')) };
};

test('golden set: 17 categories x 15 queries, vi-compound 30, eval format, unique ids', () => {
  const { golden } = make();
  assert.equal(categories.length, 17);
  assert.equal(golden.length, 270);
  assert.equal(new Set(golden.map((q) => q.id)).size, 270);
  for (const c of categories) assert.equal(golden.filter((q) => q.category === c).length, queriesPer(c), c);
  assert.equal(queriesPer('vi-compound'), 30);
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

test('harder vi-compound cases: compound once in the target, syllables reversed or apart in three distractors', () => {
  const { out, golden } = make();
  const hard = golden.filter((q) => q.hard);
  assert.equal(hard.length, 15);
  assert.deepEqual([...new Set(hard.map((q) => q.hard))].sort(), ['accented', 'context', 'folded']);
  const lexicon = fs.readFileSync(path.join(out, '_ohs/lexicon.md'), 'utf8');
  for (const q of hard) {
    assert.equal(q.category, 'vi-compound');
    const target = fs.readFileSync(path.join(out, q.relevant_paths[0]), 'utf8');
    const [a, b] = target.match(/nói chuyện về (\S+ \S+) với/)[1].split(' ');
    assert.equal(target.split(`${a} ${b}`).length - 1, 1, q.id);
    assert.ok(!lexicon.includes(`${a} ${b}`), `${a} ${b} must not be in the lexicon`);
    if (q.hard === 'folded') assert.equal(q.query, strip(`${a} ${b}`));
    else assert.ok(q.query.endsWith(`${a} ${b}`), q.id);
  }
});
