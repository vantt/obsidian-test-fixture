# Troubleshooting

## Indenting the ported presets changed the notes
- Symptom: after wrapping the script body in a function and indenting it, YAML frontmatter inside template literals gained leading spaces, so hashes would differ.
- Fix: regenerated the preset files without indenting the body (see DECISIONS D4). The parity hashes caught it before the first run.

## `node --test test/` fails on Node 24
- Symptom: `Cannot find module '.../test'`.
- Fix: list the test files in `npm test` (DECISIONS D8).

## `assert.match` with a string
- Symptom: `The "regexp" argument must be an instance of RegExp` in the CLI test.
- Fix: use `assert.ok(stdout.includes(hash))`.
