# Decisions

Each entry: problem, decision, reason.

## D1 Visibility, license, package name, distribution
- Problem: the handoff left these open.
- Decision: public repo, MIT license, package name `obsidian-test-fixture`, installed from GitHub tags only (no npm publish).
- Reason: chosen by the owner up front. Tags give pinned versions without an npm token.

## D2 js-yaml is vendored (replaces the optional `yaml` peer, changed in 0.1.1)
- Problem: the source `gt.mjs yaml` command imported the `yaml` package, so "Node built-ins only" could not hold for that command. 0.1.0 made it an optional peer dependency.
- Decision: copy `js-yaml@4.1.0` (`dist/js-yaml.mjs`, MIT, license in `vendor/js-yaml.LICENSE`) into `vendor/` and call `load(text, { schema: CORE_SCHEMA })`. No dependencies at all.
- Reason: `npx` works with nothing to install. The default js-yaml schema turns `2026-01-15` into a Date, which would change `truth yaml` output; `CORE_SCHEMA` has no timestamp type, so dates stay strings as before. Parity tests confirm identical output. Only the wording of parse-error messages differs. Update the copy by hand when js-yaml publishes a security fix.

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

## D9 Answer key outside the vault (0.3.0)
- Problem: the personal-vault marker holds the S6 answer key, and an agent under test lists the vault root and sometimes reads it (obsidian-agentkit E8 round 0).
- Decision: opt-in `--answers-out <file>` writes the key (same JSON as the old marker) outside the vault; the marker keeps its name with `{synthetic, generator, seed}` only. A preset returns such files in `files.outside`; options marked `outside: true` must not resolve inside `--out`, and the manifest records only that one was given.
- Reason: guards that check for the marker keep working, judges read the key from the new file with no format change, and the default tree stays byte-identical. The path stays out of the manifest because the manifest is in the vault, and the path would show the agent where to look.
