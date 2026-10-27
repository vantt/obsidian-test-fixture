# obsidian-test-fixture

Generate realistic, deterministic Obsidian vaults with a machine-readable answer key. For testing tools that read notes: knowledge-graph builders, RAG over notes, CLI wrappers. Zero runtime dependencies, Node >= 20.

Every word is generated. Same preset + same seed + same version gives byte-identical output (line endings and NFC file names included).

## Install

```bash
npm i -D github:vantt/obsidian-test-fixture#v0.4.0
npx github:vantt/obsidian-test-fixture#v0.4.0 generate --preset personal-vault --seed 7 --out ./vault
```

Not published on the npm registry. Pin a tag.

## CLI

```
otf generate --preset hard-cases|personal-vault|kg-solo --out <dir> [--seed S] [--bulk N] [--standalone] [--git] [--lab-dir D] [--marker F] [--answers-out F] [--clients N] [--days N] [--answers F] [--ui]
otf truth <tasks|backlinks|unresolved|tags|yaml|crlf> <vault> [args]
otf graph <vault> [--out graph.json]
otf kg <vault> <stats|validate|cases|case <id>|query <json>> [--answers F]
otf verify <vault>
otf presets
```

- `generate` refuses a non-empty `--out`. It writes `.fixture-manifest.json` (preset, resolved options, version, tree hash, file count). Dot-files are not indexed by Obsidian or by `truth`/`graph`.
- `kg` runs the reference knowledge-graph engine (`lib/kg.mjs`) over any vault: `case <id>` re-answers one case of the answer key and prints `ok`, `query` takes a JSON query such as `{"op":"reach","node":"Yếu tố/Giờ ngủ.md","rels":["decreases"]}`. Schema and cases come from the vault's `.kg-answers.json`; without one the `kg-solo` schema is used.
- `verify` re-hashes the vault against that manifest (exit 1 on mismatch).
- `truth` answers from files alone, no Obsidian needed. Output is JSON, same as obsidian-agentkit's `gt.mjs`:
  - `tasks [folder]`: open/done counts outside code
  - `backlinks <note>`: files linking to a note (with counts)
  - `unresolved [folder]`: wikilink targets that match nothing
  - `tags <tag> [folder]`: `#tag` in body (outside code) and in frontmatter
  - `yaml <note>`: frontmatter keys and types (vendored js-yaml, `CORE_SCHEMA`)
  - `crlf <note>`: line count and line-ending mix

## Library

```js
import { generate, buildGraph, truth, verify, treeHash, presets } from 'obsidian-test-fixture';
generate({ preset: 'hard-cases', out: dir, options: { bulk: 200 }, git: false }); // -> { files, treeHash }
const graph = buildGraph(dir);
const res = await truth('backlinks', dir, ['Target Note.md']);
```

Also importable: `obsidian-test-fixture/truth`, `/graph`, `/kg`, `/presets/hard-cases`, `/presets/personal-vault`, `/presets/kg-solo` (each preset exports `build(options) -> Map<path, text>`, `options`, `description`).

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

Options: `--seed` (7), `--lab-dir` (`_agentkit-lab`), `--marker` (`.e8-synthetic`), `--answers-out` (none). Daily notes at the root, People, Projects, Work/Meetings, Reference/Articles, Recipes, Books, Travel, Inbox, `.obsidian/` config, the `hard-cases` fixture under the lab dir, and a marker file with the "Đà Nẵng" answer key (`s6.relevant`, `passing`, `decoys`). The marker's JSON shape is `{about, generator, seed, s6}`. With `--git` the vault is committed (autocrlf off).

When an agent under test works on the vault, keep the key out of its reach: `--answers-out <file>` writes that same JSON to a file outside the vault (refused if inside `--out`), and the marker then only says `{"synthetic": true, "generator": ..., "seed": ...}`. The manifest records `answersOut: true`, not the path. Put the file somewhere the agent cannot read.

```bash
otf generate --preset personal-vault --git --out ./vault-synth --answers-out ~/.local/state/my-eval/answer-key.json
```

### `kg-solo` (about 750 notes by default, 4,800 with `--clients 300 --days 730`)

The knowledge graph of a one-person consulting business, for testing graph indexes, typed-edge queries, validators and question answering over notes. Options: `--seed` (11), `--clients` (30, procedural clients on top of the core story, about 13 notes each), `--days` (365, daily notes ending at 2026-10-15), `--answers` (`.kg-answers.json`), `--ui` (off; see below).

Typed edges are frontmatter keys holding quoted wikilinks (`uses: ["[[Webflow]]"]`); a claim note is one edge (cause -> effect, or subject -> object) with status, confidence, sources (down to a `#^block`) and a validity window. Inverse names (`used_by`, `has_contract`, `contact`) are implied, never written, except where a planted error writes one.

| Area | What is in the vault |
|---|---|
| Core story (fixed at any seed and size) | 3 clients, 6 people, 5 projects, 3 contracts (one renewed), 5 meetings with block ids, 3 decisions (one reversed), 2 price lists, 3 sources, 21 factors, 25 claims, 4 MOCs, 7 concepts |
| Time | contact person of a client changes on 2026-04-01; a person moves to another client; contract, price list and decision replaced by newer ones (`superseded_by`, `valid_from`/`valid_to`) |
| Causal model | one reinforcing loop (revenue, marketing, leads, projects), two balancing loops (overload; overload, sleep, burnout, response time), a `conditions` chain with a branch that only exists from 2026, a `prevents` link, a correlation that is not causation, proposals waiting to be upgraded |
| Identity | links written through aliases (`[[ABC Corp]]`), a duplicate client created by an LLM (`Cua hang Moc`), two different people whose names collide without diacritics (`Nguyễn Văn An`, `Nguyễn Văn Ân`) |
| Planted errors | one per schema rule R2-R10 (12 in all), and no other error at any size |
| Procedural clients | people, contact changes, projects (some linked by alias), contracts and renewals, meetings, decisions, and two factors per client wired into the causal model (two more loops per client) |

`.kg-answers.json` holds `schema` (types, edges with domain, range, inverse, polarity; fact relations; claim fields; rules R1-R10), `stats` (notes and edges by type and relation), and `cases`: 45 hand-designed questions in Vietnamese, tagged with the problem they test (`bt`: BT1 browsing, BT2 multi-hop, BT3 answering, BT4 identity, BT5 types, BT6 typed relations, BT7 evidence, BT8 causality, BT9 time, BT10 navigation, BT11 schema, BT12 LLM proposals), plus a few cases per procedural client and scale cases (all loops, multi-step upstream). Each case has `question`, `query` (or `queries`), `expect`, and two tags:

- `mode`, how a person gets to it: `navigate` (step through views), `search` (type a few words, get a report page), `ask` (question to an agent), `push` (the system brings it up), `write` (suggestion while writing a note);
- `strategy`, how an agent should answer: `resolve` (find the note from what was typed first; several hits mean ask back, see `behavior`), `one-shot` (the query is known up front: one or a few fixed tool calls), `explore` (the path is not known up front: walk the graph step by step; `query` is only the reference for grading, `budget` caps tool calls).

Query ops (`lib/kg.mjs`): `neighbors`, `reach`, `paths` (with net sign), `cycles` (reinforcing or balancing), `chain` (steps with their own dates), `provenance`, `valid`, `select`, `find` (word match ignoring case and diacritics, over titles and aliases), `resolve`, `field`, `mentions`, `collisions`, `validate`. `asOf` filters by validity window; claim edges count when `accepted` or `superseded` unless `statuses` says otherwise; links resolve by title, then alias.

Every `expect` is computed by `lib/kg.mjs` over the written files; `test/kg.test.mjs` pins the hand-designed answers by hand at two sizes.

### `kg-solo --ui`: a vault to try in Obsidian

`--ui` adds a UI layer on top of the same notes. Without it the tree is byte-identical to before (parity test); the answer key is the same too, except `stats` counts the guide note.

| Added | What |
|---|---|
| `.obsidian/` | `app.json`, `core-plugins.json` (Bases on), `types.json` (date and number properties), and `plugins/breadcrumbs/data.json`, `plugins/excalibrain/data.json`: the plugins' own settings files. No plugin code; install and enable Breadcrumbs, Dataview, Excalidraw, ExcaliBrain yourself and they find their settings in place |
| `Bases/*.base` | current contact, active contracts, projects, LLM proposals pending, claims of a factor. Each has an all-vault view and a "Của trang này" view filtered by `this.file`; dates compare against the answer key's today (2026-10-15), not the real date |
| Report pages | every organization, project and factor note ends with a "Tổng hợp" section embedding the matching views (`![[Bases/X.base#Của trang này]]`) |
| `Hướng dẫn thử.md` | setup, then exercises for way 1 (navigate: breadcrumbs, ExcaliBrain) and way 2 (search: Quick Switcher, report page) of obsidian-pkm-automation `docs/knowledge-graph/usage.md`; each exercise quotes its case id and the case's expected answer, with a phone/desktop result table |

Breadcrumbs: edge fields `up`/`down`, `parent_moc`/`child_moc`, `part_of`/`has_part`, `conditions`/`conditioned_by`, `next`/`prev`, `related`; the inverse of each is implied by a transitive rule (the vault never writes inverses). ExcaliBrain: parents `up`, `parent_moc`, `part_of`; children `down`, `child_moc`, `has_part`; friends `related`; siblings are inferred. Formats are those of Obsidian Bases (help.obsidian.md), Breadcrumbs 4.22.1 and ExcaliBrain 0.2.19; sources are listed at the top of `presets/kg-solo-ui.mjs`. The tests check that the files parse, agree with the schema and point at real bases and views; they cannot run Obsidian, so what the plugins display is for the guide's exercises to confirm.

## Graph export

`otf graph <vault>` prints:

```json
{ "version": 1, "generator": {"preset": "hard-cases", "seed": 42, "otfVersion": "0.1.1"},
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
7. Frontmatter edges also carry `key`, the frontmatter property that holds the link (`uses`, `client`, ...): the relation name of a typed edge.
8. `line` is the 1-based line in the file. `folder` is `""` for root notes. Node `tags` are frontmatter tags plus body `#tags` outside code (a tag needs a non-digit character), sorted.

## Determinism and versioning

- Same preset, same options, same version: byte-identical tree. `test/fixtures/parity.json` holds the tree hashes recorded from obsidian-agentkit's original scripts (`kg-solo`: recorded in this repo); CI checks them on ubuntu and windows, Node 20 and 22.
- Any change to generated output (including the marker text) is a breaking change: new minor version, entry in `CHANGELOG.md`. Answer keys downstream depend on it. Pin a tag.
- Tree hash: sha256 over `<path>\0<size>\0<sha256(content)>\n` for each file sorted by code point, top-level `.git` and `.fixture-manifest.json` skipped.

## Add a preset

1. Create `presets/<name>.mjs` exporting `name`, `description`, `options` (`{ key: { default, description } }`) and `build(options) -> Map<relativePath, text>`. Use `createRng(seed)` from `lib/prng.mjs`; never `Math.random()` or dates.
2. Register it in `lib/index.mjs` (`presets`). The CLI picks up its options as `--kebab-case` flags (number defaults parse as numbers, boolean defaults are flags).
3. Record its tree hash in `test/fixtures/parity.json` and add it to `test/helpers.mjs`; add graph/truth tests with hand-checked answers.
4. Add a `CHANGELOG.md` entry. Run `npm test` and `scripts/privacy-scan.sh`.

## License

MIT
