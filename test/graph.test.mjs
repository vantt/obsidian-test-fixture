import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraph } from '../lib/graph.mjs';
import { vault } from './helpers.mjs';

const g = buildGraph(vault('hard-cases'));
const incoming = g.edges.filter((e) => e.to === 'Target Note.md');

test('9 incoming edges to Target Note.md, one per link form', () => {
  assert.equal(incoming.length, 9);
  assert.deepEqual(Object.fromEntries(incoming.map((e) => [e.from, e.kind])), {
    'refs/ref-wikilink.md': 'wikilink',
    'refs/ref-alias-display.md': 'wikilink',
    'refs/ref-heading.md': 'heading',
    'refs/ref-block.md': 'block',
    'refs/ref-embed.md': 'embed',
    'refs/deeper/ref-markdown.md': 'markdown',
    'other folder/ref-other-folder.md': 'heading',
    'props/Property Note.md': 'frontmatter',
    'tiếng việt/Ghi chú tiếng Việt.md': 'wikilink',
  });
  assert.ok(incoming.every((e) => e.resolved));
});

test('block and heading targets keep their fragment', () => {
  assert.equal(g.edges.find((e) => e.from === 'refs/ref-block.md').target, 'Target Note#^blk1');
  assert.equal(g.edges.find((e) => e.from === 'refs/ref-heading.md').target, 'Target Note#Section A');
  assert.equal(g.edges.find((e) => e.from === 'refs/ref-heading.md').line, 1);
});

test('links inside code are excluded, not edges', () => {
  assert.deepEqual(g.excluded.filter((x) => x.from === 'refs/ref-code-block.md').map(({ raw, reason }) => ({ raw, reason })), [
    { raw: '[[Target Note]]', reason: 'code-block' },
    { raw: '[[Target Note]]', reason: 'inline-code' },
  ]);
  assert.equal(g.edges.some((e) => e.from === 'refs/ref-code-block.md'), false);
});

test('2 unresolved targets; the alias name does not resolve', () => {
  assert.deepEqual(g.unresolved.map((u) => u.target).sort(), ['Missing Note Zeta', 'TN Alias']);
  assert.equal(g.edges.find((e) => e.from === 'refs/ref-alias-name.md').resolved, false);
});

test('nodes carry title, aliases, tags and folder', () => {
  const n = g.nodes.find((x) => x.id === 'Target Note.md');
  assert.deepEqual(n, { id: 'Target Note.md', title: 'Target Note', aliases: ['TN Alias'], tags: ['fixture'], folder: '' });
  assert.deepEqual(g.nodes.find((x) => x.id === 'tags/tag-body.md').tags, ['proj', 'proj/sub', 'projects']);
  assert.equal(g.nodes.find((x) => x.id === 'refs/deeper/ref-markdown.md').folder, 'refs/deeper');
});

test('header carries generator info from the manifest', () => {
  assert.deepEqual(g.generator, { preset: 'hard-cases', seed: 42, otfVersion: g.generator.otfVersion });
  assert.equal(g.version, 1);
});

test('graph edges agree with truth backlinks on every vault', async () => {
  const { truth } = await import('../lib/truth.mjs');
  for (const name of ['hard-cases', 'personal-vault-seed7']) {
    const v = vault(name);
    const t = name === 'hard-cases' ? 'Target Note.md' : '_agentkit-lab/Target Note.md';
    const bl = await truth('backlinks', v, [t]);
    const ge = buildGraph(v).edges.filter((e) => e.to === t && e.from !== t);
    assert.equal(new Set(ge.map((e) => e.from)).size, bl.total);
    assert.equal(ge.length, bl.files.reduce((s, f) => s + f.count, 0));
  }
});
