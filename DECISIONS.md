# Decisions

Each entry: problem, decision, reason.

## D1 Visibility, license, package name, distribution
- Problem: the handoff left these open.
- Decision: public repo, MIT license, package name `obsidian-test-fixture`, installed from GitHub tags only (no npm publish).
- Reason: chosen by the owner up front. Tags give pinned versions without an npm token.

## D2 `yaml` is an optional peer dependency
- Problem: the source `gt.mjs yaml` command imports the `yaml` package, so "Node built-ins only" cannot hold for that one command.
- Decision: `yaml` is an optional peer dependency, imported lazily by `truth yaml`. Without it the command exits 2 with an install hint. It is a devDependency here so parity tests run. Generation, every other truth command and `graph` need nothing.
- Reason: keeps the install at zero runtime dependencies while keeping the output of `truth yaml` identical to `gt.mjs`.

## D3 Tree hash definition
- Problem: "byte-identical" needs a checkable number, and the personal vault also has a `.git/` directory and a manifest.
- Decision: sha256 over, for each file sorted by code point, `<path>\0<size>\0<sha256(content)>\n`, with `/` separators. Top-level `.git` and `.fixture-manifest.json` are skipped.
- Reason: independent of OS, mtime and git object ids. The manifest holds the hash, so it cannot be part of it.

## D4 Preset bodies are not indented
- Problem: the preset code is a near-verbatim port, and many notes are multi-line template literals. Indenting the body would add spaces inside the notes.
- Decision: keep the ported body at column 0 inside `build()`, with a comment saying why.
- Reason: byte parity beats style, and a diff against the original scripts stays readable.

## D5 Agentkit-specific strings stay as defaults
- Problem: `_agentkit-lab/`, `.e8-synthetic`, and the marker's `about` and `generator` strings are agentkit names, but the personal-vault hash must match today's output.
- Decision: `--lab-dir` and `--marker` are options with today's values as defaults. The marker's JSON text (`about`, `generator`) is unchanged for now.
- Reason: agentkit's guard reads the marker's shape. Changing the text is an output change, so it would need a new minor version.

## D6 Generator options and `--git`
- Problem: the handoff lists `git` under personal-vault options but also as a generic CLI flag.
- Decision: `--git` is generic (any preset); it is not a preset option. `hard-cases` also gets `--lab-dir` (default empty), as the handoff lists it.
- Reason: one place implements it. Defaults do not change output.

## D7 Graph conventions
- Problem: the spec fixes the shape but not edge cases.
- Decision: unresolved links are edges with `to: null, resolved: false`, and also listed in `unresolved` (wiki-style links only, like `truth unresolved`). Root-folder notes have `folder: ""`. Node tags are frontmatter tags plus body tags outside code. `excluded` entries also carry `line`.
- Reason: keeps edges complete for graph tools while `unresolved` matches the truth command.

## D8 Test script lists files
- Problem: `node --test test/` fails on Node 24, and shell globs are not expanded on Windows.
- Decision: `npm test` names the test files explicitly.
- Reason: runs the same on Node 20 and 22, ubuntu and windows.
