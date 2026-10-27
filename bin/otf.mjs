#!/usr/bin/env node
import fs from 'node:fs';
import { COMMANDS, UsageError, format, truth } from '../lib/truth.mjs';
import { buildGraph } from '../lib/graph.mjs';
import { generate, presets, verify, version } from '../lib/index.mjs';

const USAGE = `otf ${version}
usage:
  otf generate --preset <name> --out <dir> [--seed S] [--bulk N] [--standalone] [--git] [--lab-dir D] [--marker F]
  otf truth <${COMMANDS.join('|')}> <vault> [args]
  otf graph <vault> [--out graph.json]
  otf verify <vault>
  otf presets`;

const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const fail = (msg, code = 2) => { console.error(msg); process.exit(code); };

function flags(argv, spec) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const name = a.slice(2);
    if (!(name in spec)) fail(`unknown option: ${a}\n${USAGE}`);
    if (spec[name] === 'bool') out[name] = true;
    else { if (argv[i + 1] === undefined) fail(`${a} needs a value`); out[name] = argv[++i]; }
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  switch (cmd) {
    case 'generate': {
      const spec = { preset: 'val', out: 'val', git: 'bool' };
      for (const p of Object.values(presets)) for (const [k, o] of Object.entries(p.options)) spec[kebab(k)] = typeof o.default === 'boolean' ? 'bool' : 'val';
      const f = flags(rest, spec);
      if (!f.preset || !f.out) fail(USAGE);
      const preset = presets[f.preset];
      if (!preset) fail(`unknown preset: ${f.preset} (have: ${Object.keys(presets).join(', ')})`);
      const options = {};
      for (const [k, o] of Object.entries(preset.options)) {
        const v = f[kebab(k)];
        if (v !== undefined) options[k] = typeof o.default === 'number' ? Number(v) : v;
      }
      for (const k of Object.keys(f)) if (k !== '_' && !['preset', 'out', 'git'].includes(k) && !Object.keys(preset.options).some((o) => kebab(o) === k)) fail(`preset ${f.preset} has no option --${k}`);
      const r = generate({ preset: f.preset, out: f.out, options, git: !!f.git });
      console.log(`wrote ${r.files} files to ${f.out}${f.git ? '; git initialised' : ''}\ntree hash ${r.treeHash}`);
      break;
    }
    case 'truth': {
      const [sub, vault, ...args] = rest;
      if (!sub || !vault) fail(`usage: otf truth <${COMMANDS.join('|')}> <vault> [args]`);
      console.log(format(await truth(sub, vault, args)));
      break;
    }
    case 'graph': {
      const f = flags(rest, { out: 'val' });
      if (!f._[0]) fail('usage: otf graph <vault> [--out graph.json]');
      const text = JSON.stringify(buildGraph(f._[0], { otfVersion: version }), null, 2) + '\n';
      if (f.out) fs.writeFileSync(f.out, text); else process.stdout.write(text);
      break;
    }
    case 'verify': {
      if (!rest[0]) fail('usage: otf verify <vault>');
      const r = verify(rest[0]);
      console.log(r.ok ? `ok ${r.preset} ${r.actual}` : `MISMATCH ${r.preset}: manifest ${r.expected}, actual ${r.actual}`);
      process.exit(r.ok ? 0 : 1);
    }
    case 'presets': {
      for (const [name, p] of Object.entries(presets)) {
        console.log(`${name}: ${p.description}`);
        for (const [k, o] of Object.entries(p.options)) console.log(`  --${kebab(k)} (default ${JSON.stringify(o.default)}): ${o.description}`);
      }
      console.log('generic: --out <dir> (must be empty), --git (init and commit)');
      break;
    }
    default: fail(USAGE);
  }
} catch (e) {
  if (e instanceof UsageError || /^refusing:|^unknown preset|^preset /.test(e.message)) fail(e.message);
  throw e;
}
