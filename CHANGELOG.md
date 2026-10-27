# Changelog

Any change to generated output is a breaking change and needs a new minor version here, because downstream answer keys depend on it.

## 0.5.0
- `kg-solo --ui` (library option `ui`): writes `.obsidian/` config (core Bases, property types, Breadcrumbs and ExcaliBrain settings), five `.base` files, embedded views at the end of every organization, project and factor note, and `Hướng dẫn thử.md` (exercises tied to answer-key cases). No plugin code.
- Without `--ui` the generated tree is unchanged (parity tests); the manifest options list gains `ui: false`, and the manifest is outside the tree hash. With `--ui` the answer key has the same cases and answers; only `stats` counts the guide note.

## 0.4.0
- `kg-solo` cases carry `mode` (navigate, search, ask, push, write) and `strategy` (resolve, one-shot, explore); explore cases carry a tool-call `budget`, ambiguous lookups a `behavior` (clarify, merge-aware).
- Seven new cases: a search report page, lookups without diacritics, an ambiguous person, a duplicate client, a suggestion while writing, two explore questions. The answer key changes, so the `kg-solo` tree hash changes.
- New query op `find`.

## 0.3.0
- `personal-vault --answers-out <file>` (library option `answersOut`): writes the S6 answer key (the full marker JSON as before, `{about, generator, seed, s6}`) to a file outside the vault. The marker keeps its name and holds only `{synthetic, generator, seed}`, so an agent that lists or reads the vault cannot see the key. Refused if the file is inside `--out`. The manifest records `answersOut: true`, never the path.
- Without the option, generated trees, marker and manifest options are unchanged (parity tests).
- `generate()` returns `outside`, the files written outside the vault.

## 0.2.0
- New preset `kg-solo`: knowledge-graph vault of a one-person consulting business with typed edges, claims over time, causal loops, LLM proposals, planted schema errors, and an answer key (`.kg-answers.json`) of questions per problem BT1-BT12.
- New `lib/kg.mjs` (reference engine: typed edges, R1-R10 validator, query ops) and `otf kg`.
- `otf graph`: frontmatter edges carry `key`, the property holding the link. Additive; existing fields and generated trees of `hard-cases` and `personal-vault` are unchanged.

## 0.1.1
- `truth yaml` uses a vendored js-yaml 4.1.0 (`CORE_SCHEMA`) instead of the optional `yaml` peer. Generated trees and `truth` output for valid frontmatter are unchanged (parity tests); only the text of YAML parse errors differs.

## 0.1.0
- First release. `hard-cases` and `personal-vault` presets reproduce the output of obsidian-agentkit's `gen-fixture.mjs` and `gen-synth-vault.mjs` byte for byte (tree hashes in `test/fixtures/parity.json`).
- `otf truth` ports `gt.mjs` with the same output.
- `otf graph` exports the link graph as JSON.
- `otf verify` re-hashes a vault against its `.fixture-manifest.json`.
