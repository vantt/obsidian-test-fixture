// Write a Map of relative path -> text to disk, optionally as a git repo. Text is written as-is (no newline
// conversion), so the CRLF note stays CRLF on Windows. File names are normalised to NFC.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function assertEmpty(outDir) {
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) throw new Error(`refusing: ${outDir} is not empty`);
}

export function writeFiles(outDir, files) {
  for (const [name, text] of files) {
    const p = path.join(outDir, ...name.normalize('NFC').split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
}

export function gitCommit(outDir, message = 'synthetic vault') {
  const git = (...a) => {
    const r = spawnSync('git', ['-C', outDir, ...a], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${a[0]}: ${r.stderr}`);
  };
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  git('config', 'user.name', 'otf'); git('config', 'user.email', 'otf@example.invalid');
  git('add', '-A');
  git('commit', '-qm', message);
}
