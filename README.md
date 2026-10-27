# obsidian-test-fixture

Generate realistic, deterministic Obsidian vaults with a machine-readable answer key. For testing tools that read notes: knowledge-graph builders, RAG over notes, CLI wrappers. Zero runtime dependencies, Node >= 20.

Every word is generated. Same preset + same seed + same version gives byte-identical output (line endings and NFC file names included).

## Install

```bash
npm i -D github:vantt/obsidian-test-fixture#v0.1.0
npx github:vantt/obsidian-test-fixture#v0.1.0 generate --preset personal-vault --seed 7 --out ./vault
```

Not published on the npm registry. Pin a tag.

## CLI

```
otf generate --preset hard-cases|personal-vault --out <dir> [--seed S] [--bulk N] [--standalone] [--git] [--lab-dir D] [--marker F]
otf truth <tasks|backlinks|unresolved|tags|yaml|crlf> <vault> [args]
otf graph <vault> [--out graph.json]
otf verify <vault>
otf presets
```

- `generate` refuses a non-empty `--out`. It writes `.fixture-manifest.json` (preset, resolved options, version, tree hash, file count). Dot-files are not indexed by Obsidian or by `truth`/`graph`.
- `verify` re-hashes the vault against that manifest (exit 1 on mismatch).
- `truth` answers from files alone, no Obsidian needed. Output is JSON, same as obsidian-agentkit's `gt.mjs`:
  - `tasks [folder]`: open/done counts outside code
  - `backlinks <note>`: files linking to a note (with counts)
  - `unresolved [folder]`: wikilink targets that match nothing
  - `tags <tag> [folder]`: `#tag` in body (outside code) and in frontmatter
  - `yaml <note>`: frontmatter keys and types (needs `npm i yaml`, optional)
  - `crlf <note>`: line count and line-ending mix

## Library

```js
import { generate, buildGraph, truth, verify, treeHash, presets } from 'obsidian-test-fixture';
generate({ preset: 'hard-cases', out: dir, options: { bulk: 200 }, git: false }); // -> { files, treeHash }
const graph = buildGraph(dir);
const res = await truth('backlinks', dir, ['Target Note.md']);
```

Also importable: `obsidian-test-fixture/truth`, `/graph`, `/presets/hard-cases`, `/presets/personal-vault` (each preset exports `build(options) -> Map<path, text>`, `options`, `description`).

## Presets

### `hard-cases` (25 notes)

Options: `--seed` (42), `--bulk N` (0), `--standalone` (adds `.obsidian/` config), `--lab-dir` (empty = vault root).

| Case | Files | What it tests |
|---|---|---|
| Nine link forms to `Target Note.md` | `refs/ref-wikilink`, `ref-alias-display`, `ref-heading`, `ref-block`, `ref-embed`, `refs/deeper/ref-markdown` (`%20` md link), `other folder/ref-other-folder`, `props/Property Note` (link in frontmatter), `tiếng việt/Ghi chú tiếng Việt` | backlinks count 9 |
| Alias name link | `refs/ref-alias-name` (`[[TN Alias]]`) | does not resolve through the alias (Obsidian behaviour) |
| Links in code | `refs/ref-code-block` | fenced and inline-code links must not count |
| Unresolved link | `refs/ref-unresolved` | `Missing Note Zeta` |
| Typed properties | `props/Property Note` | string with colon, date, datetime, number, bool, lists |
| Tag look-alikes | `tags/*` | `#proj` vs `#projects` vs `#proj/sub`, frontmatter tags, code `#proj`, heading `# proj` |
| Tasks | `tasks/odd`, `tasks/even` | open/done, nested tasks, task inside a code block (not counted) |
| Vietnamese names | `tiếng việt/*` | NFC file names, folder with a space |
| Long CRLF note | `long/Long CRLF Note.md` | 2,974 lines, all CRLF, 30 headed sections |
| Bulk | `bulk/NN/bulk-NNNNN.md` | with `--bulk N`: search-budget tests, 10% link to another bulk note |

### `personal-vault` (about 1,800 notes)

Options: `--seed` (7), `--lab-dir` (`_agentkit-lab`), `--marker` (`.e8-synthetic`). Daily notes at the root, People, Projects, Work/Meetings, Reference/Articles, Recipes, Books, Travel, Inbox, `.obsidian/` config, the `hard-cases` fixture under the lab dir, and a marker file with the "Đà Nẵng" answer key (`s6.relevant`, `passing`, `decoys`). The marker's JSON shape is `{about, generator, seed, s6}`. With `--git` the vault is committed (autocrlf off).

## Graph export

`otf graph <vault>` prints:

```json
{ "version": 1, "generator": {"preset": "hard-cases", "seed": 42, "otfVersion": "0.1.0"},
  "nodes": [{ "id": "refs/ref-heading.md", "title": "ref-heading", "aliases": [], "tags": [], "folder": "refs" }],
  "edges": [{ "from": "refs/ref-heading.md", "to": "Target Note.md", "kind": "heading", "target": "Target Note#Section A", "line": 1, "resolved": true }],
  "excluded": [{ "from": "refs/ref-code-block.md", "raw": "[[Target Note]]", "reason": "code-block", "line": 4 }],
  "unresolved": [{ "from": "refs/ref-unresolved.md", "target": "Missing Note Zeta" }] }
```

`generator` is read from the manifest (nulls for a vault not made by `otf`). Rules, all shared with `truth` (one parser):

1. Indexed files: everything not under a dot-folder or dot-file. Nodes are `.md` files; `id` is the vault-relative path with `/`.
2. Link forms: `[[T]]`, `[[T|alias]]`, `[[T#Heading]]`, `[[T#^block]]`, `![[T]]`, `[text](path.md)` (percent-decoded, `#fragment` dropped, `scheme://` skipped), and the same forms inside frontmatter. `kind` is `embed` for `!`, else `block`/`heading`/`wikilink`/`markdown`; any link in frontmatter has kind `frontmatter`. `target` keeps the fragment for wikilinks.
3. Code does not count: fenced blocks (``` or ~~~, closed by the same fence char and at least the same length) and inline `` `code` `` are blanked before scanning. Links in them go to `excluded` with reason `code-block` or `inline-code`.
4. Resolution order: empty target (`[[#H]]`) is the note itself; then exact vault path, with and without `.md`; then path relative to the source note; then for targets with `/`, a case-insensitive path-suffix match; then case-insensitive basename (shallowest path wins); then a non-md attachment by basename. Otherwise unresolved.
5. Aliases do not resolve: `[[TN Alias]]` is unresolved even though `Target Note` lists it (measured on Obsidian CLI 1.14.4, see obsidian-agentkit `docs/FINDINGS.md` F4e). Aliases are in `nodes[].aliases` so a consumer can choose to resolve them.
6. Unresolved links stay in `edges` with `to: null, resolved: false`. `unresolved` lists wikilink-style links (including frontmatter ones) only, one per link, same as `truth unresolved`.
7. `line` is the 1-based line in the file. `folder` is `""` for root notes. Node `tags` are frontmatter tags plus body `#tags` outside code (a tag needs a non-digit character), sorted.

## Determinism and versioning

- Same preset, same options, same version: byte-identical tree. `test/fixtures/parity.json` holds the tree hashes recorded from obsidian-agentkit's original scripts; CI checks them on ubuntu and windows, Node 20 and 22.
- Any change to generated output (including the marker text) is a breaking change: new minor version, entry in `CHANGELOG.md`. Answer keys downstream depend on it. Pin a tag.
- Tree hash: sha256 over `<path>\0<size>\0<sha256(content)>\n` for each file sorted by code point, top-level `.git` and `.fixture-manifest.json` skipped.

## Add a preset

1. Create `presets/<name>.mjs` exporting `name`, `description`, `options` (`{ key: { default, description } }`) and `build(options) -> Map<relativePath, text>`. Use `createRng(seed)` from `lib/prng.mjs`; never `Math.random()` or dates.
2. Register it in `lib/index.mjs` (`presets`). The CLI picks up its options as `--kebab-case` flags (number defaults parse as numbers, boolean defaults are flags).
3. Record its tree hash in `test/fixtures/parity.json` and add it to `test/helpers.mjs`; add graph/truth tests with hand-checked answers.
4. Add a `CHANGELOG.md` entry. Run `npm test` and `scripts/privacy-scan.sh`.

## License

MIT
