# Changelog

Any change to generated output is a breaking change and needs a new minor version here, because downstream answer keys depend on it.

## 0.11.0
- `vi-search`: `vi-compound` gains 15 harder queries (30 in all; the golden set has 270). With 0.10.0 the category was already at nDCG@5 1.0 for a language pack without word segmentation, so it could not show what segmentation adds. Each new case has a compound that is not in the sample lexicon; the target note has it once, and three distractor notes have both syllables more often, reversed or apart. Five queries are the compound, five the compound without marks, five the compound after a verb phrase that only the target has; the entry's `hard` field says which. The 60 new notes are generated after all others without rng calls, so every note and golden entry of 0.10.0 is unchanged; the tree and the golden set grow. Other presets are unchanged.

## 0.10.0
- `vi-search`: `vi-unaccented` and `vi-dd` now query clusters of 25 near-identical notes that differ in one key term (a dish, a street) and have numbered titles. Before, each query phrase was also the note title, and upstream search already reached Hit@5 0.93 and 0.87 through the title and the vector branch, so the category could not show what a lexical fold adds. The unaccented key terms use only syllables with a shape mark plus a tone, which `unicode61` does not fold (the single-mark ones it does), and every dd term has a đ. The generator also checks that the folded query identifies one note. Both categories carry `query_accented` (the query with its marks), for a reachability check. `vi-unaccented` no longer shares notes with `vi-accented`. The tree and the golden set change; other presets are unchanged.

## 0.9.0
- `vi-search`: the notes of `vi-compound` and `vi-synonym` no longer carry the query phrase in their title (only the body tells them apart), and a `vi-synonym` query is another form of the group alone. The first baseline showed both categories already at nDCG@5 1.0 with upstream search, which left no room to measure a language pack. The tree and the golden set of `vi-search` change; other presets are unchanged.

## 0.8.0
- New preset `vi-search`: 328 Vietnamese notes plus `_ohs/lexicon.md`, and with `--answers-out` a golden set of 17 categories x 15 queries in the obsidian-hybrid-search eval format. Existing presets and their tree hashes are unchanged.

## 0.7.0
- `kg-solo --ui`: ships the Labelled Links settings (`relationDefinitions`: one `a <-> inverse` pair per schema edge), so every typed edge shows in both directions in its relations pane, including `uses`/`client`/`party` that the Breadcrumbs fields do not cover. The Breadcrumbs matrix view now lists every group (`conditions`, `conditioned_by` were left out by the default list). The guide says where to look in each plugin (matrix panel on the right, `related` heading, relations pane). `--ui` output changes; trees without `--ui` are unchanged.
- Checked in Obsidian 1.15.0 with Labelled Links 1.1.0: the relations pane of Metabase, Supabase and Dashboard doanh thu ABC matches the answer key.

## 0.6.0
- `kg-solo --ui`: fixes the "current contact" base. `!valid_to` matches nothing on a note without that property (measured on Obsidian 1.15.0); the validity formula now uses `valid_to.isEmpty()`. The guide records what was measured (the project view of a client shows 1 of 2 because `file.hasLink` does not follow aliases; ExcaliBrain builds from plain links for a note without `up`/`part_of`). Output of `--ui` changes; trees without `--ui` are unchanged.
- Checked in Obsidian 1.15.0 with Breadcrumbs 4.22.1, ExcaliBrain 0.2.19, Dataview 0.5.68: all views of the four whole-vault bases equal the reference engine at 755 and 4,840 notes, plugin settings load, no errors.

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
