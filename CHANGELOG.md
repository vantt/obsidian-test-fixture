# Changelog

Any change to generated output is a breaking change and needs a new minor version here, because downstream answer keys depend on it.

## 0.1.1
- `truth yaml` uses a vendored js-yaml 4.1.0 (`CORE_SCHEMA`) instead of the optional `yaml` peer. Generated trees and `truth` output for valid frontmatter are unchanged (parity tests); only the text of YAML parse errors differs.

## 0.1.0
- First release. `hard-cases` and `personal-vault` presets reproduce the output of obsidian-agentkit's `gen-fixture.mjs` and `gen-synth-vault.mjs` byte for byte (tree hashes in `test/fixtures/parity.json`).
- `otf truth` ports `gt.mjs` with the same output.
- `otf graph` exports the link graph as JSON.
- `otf verify` re-hashes a vault against its `.fixture-manifest.json`.
