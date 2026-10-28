// Each whole-vault view of the four bases, queried through `obsidian base:query`, equals the reference engine.
// Machine-specific (uses the `obsidian` CLI); not part of `npm test`.
import { spawnSync } from 'node:child_process';
import { loadKg, readVault, runQuery } from '../lib/kg.mjs';
const [dir, vault] = process.argv.slice(2);
if (!dir || !vault) { console.error('usage: node scripts/obsidian-bases-check.mjs <vault-dir> <obsidian-vault-name>'); process.exit(2); }
const key = JSON.parse((await import('node:fs')).readFileSync(`${dir}/.kg-answers.json`, 'utf8'));
const kg = loadKg(readVault(dir), key.schema);
const T = key.today;
const q = (base, view) => spawnSync('obsidian', [`vault=${vault}`, 'base:query', `path=Bases/${base}.base`, `view=${view}`, 'format=paths'], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean).sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const report = (name, got, want) => console.log(same(got, want) ? 'OK  ' : 'DIFF', name, got.length, want.length, same(got, want) ? '' : `\n  only obsidian: ${got.filter((x) => !want.includes(x)).slice(0, 4)}\n  only engine: ${want.filter((x) => !got.includes(x)).slice(0, 4)}`);
const win = (n) => n.fm.valid_from <= T && (!n.fm.valid_to || n.fm.valid_to >= T);
const notes = [...kg.notes.values()];
report('contracts now', q('Hợp đồng đang chạy', 'Tất cả hợp đồng đang chạy'), notes.filter((n) => n.type === 'contract' && win(n)).map((n) => n.id).sort());
report('contacts now', q('Đầu mối hiện tại', 'Tất cả đầu mối hiện tại'), notes.filter((n) => n.type === 'claim' && n.fm.relation === 'contact_for' && ['accepted', 'superseded'].includes(n.fm.status) && win(n)).map((n) => n.id).sort());
report('projects active', q('Dự án', 'Đang chạy'), notes.filter((n) => n.type === 'project' && n.fm.status === 'active').map((n) => n.id).sort());
report('projects all', q('Dự án', 'Tất cả dự án'), notes.filter((n) => n.type === 'project').map((n) => n.id).sort());
report('llm pending', q('Đề xuất LLM chờ duyệt', 'Chờ duyệt'), runQuery(kg, { op: 'select', where: { type: 'claim', status: 'proposed', proposed_by: 'llm' } }).sort());
