#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const db = { _comment: 'KONOMIOKE TAG.DB', _built: new Date().toISOString(), udt_types: {}, tags: {} };

// Load all tag configs
for (const f of readdirSync(join(ROOT, 'tags'))) {
  if (!f.endsWith('.json')) continue;
  const tag = JSON.parse(readFileSync(join(ROOT, 'tags', f), 'utf-8'));
  const id = f.replace('.json', '');
  const udt = tag._udt || 'Config';
  db.udt_types[udt] = db.udt_types[udt] || { desc: udt, count: 0 };
  db.udt_types[udt].count++;
  db.tags[id] = { udt, ...tag };
  delete db.tags[id]._udt;
}

// Scan phases
for (const f of readdirSync(join(ROOT, 'phases'))) {
  if (!f.endsWith('.js')) continue;
  const stat = statSync(join(ROOT, 'phases', f));
  const src = readFileSync(join(ROOT, 'phases', f), 'utf-8');
  db.tags[`phase:${f.replace('.js','')}`] = {
    udt: 'Phase', file: `phases/${f}`, lines: src.split('\n').length,
    size: stat.size, hasExport: src.includes('export '),
  };
}
db.udt_types['Phase'] = { desc: 'Konomioke prime phase module', count: Object.keys(db.tags).filter(k => k.startsWith('phase:')).length };

// Scan lib
for (const f of readdirSync(join(ROOT, 'lib'))) {
  if (!f.endsWith('.js')) continue;
  const stat = statSync(join(ROOT, 'lib', f));
  db.tags[`lib:${f.replace('.js','')}`] = { udt: 'Lib', file: `lib/${f}`, size: stat.size };
}
db.udt_types['Lib'] = { desc: 'Library module', count: Object.keys(db.tags).filter(k => k.startsWith('lib:')).length };

const tc = Object.keys(db.tags).length;
const uc = Object.keys(db.udt_types).length;
writeFileSync(join(ROOT, 'tag.db'), JSON.stringify(db, null, 1));
console.log(`tag.db: ${uc} types, ${tc} tags`);
Object.entries(db.udt_types).forEach(([k,v]) => console.log(`  ${k.padEnd(20)} ${v.count}`));
