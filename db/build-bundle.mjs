#!/usr/bin/env node
/**
 * Build bundle.db — SQLite database holding all source code, views, styles.
 * Replaces bundle.js with queryable tables.
 *
 * Tables:
 *   modules — JS source files (id, phase, class, source, lines)
 *   views   — HTML templates (id, slot, type, source)
 *   styles  — CSS files (id, section, source)
 *
 * Query to assemble bundle.js:
 *   SELECT source FROM modules ORDER BY sort_order
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const db = new Database(join(ROOT, 'bundle.db'));

db.exec(`
  DROP TABLE IF EXISTS modules;
  DROP TABLE IF EXISTS views;
  DROP TABLE IF EXISTS styles;

  CREATE TABLE modules (
    id TEXT PRIMARY KEY,
    phase INTEGER,
    class_name TEXT,
    file TEXT,
    sort_order INTEGER,
    lines INTEGER,
    source TEXT
  );

  CREATE TABLE views (
    id TEXT PRIMARY KEY,
    slot TEXT,
    type TEXT,
    file TEXT,
    source TEXT
  );

  CREATE TABLE styles (
    id TEXT PRIMARY KEY,
    section TEXT,
    file TEXT,
    source TEXT
  );
`);

const ins = db.prepare('INSERT INTO modules VALUES (?,?,?,?,?,?,?)');
const modules = [
  ['globals',    0,  null,                'js/globals.js',                 0],
  ['identity',   2,  'KonomiIdentity',    'js/p2-identity/identity.js',    1],
  ['crdt-queue', 11, 'CRDTQueue',         'js/p11-tracks/crdt-queue.js',   2],
  ['mesh',       3,  'KonomiMesh',        'js/p3-mesh/mesh.js',            3],
  ['fabric',     5,  'AudioFabricEngine', 'js/p5-fabric/fabric.js',        4],
  ['vocal',      7,  'VocalProcessor',    'js/p7-vocal/vocal.js',          5],
  ['tracks',     11, 'TrackEngine',       'js/p11-tracks/tracks.js',       6],
  ['viz',        13, 'VizEngine',         'js/p13-viz/viz.js',             7],
  ['app',        17, 'KonomiApp',         'js/p17-app/app.js',             8],
  ['boot',       17, null,                'js/p17-app/boot.js',            9],
];

for (const [id, phase, cls, file, order] of modules) {
  const src = readFileSync(join(ROOT, file), 'utf-8');
  ins.run(id, phase, cls, file, order, src.split('\n').length, src);
}

const insV = db.prepare('INSERT INTO views VALUES (?,?,?,?,?)');
const views = [
  ['canvas', 'body',    'canvas', 'ui/html-canvas.html'],
  ['boot',   'body',    'screen', 'ui/html-boot.html'],
  ['lobby',  'body',    'screen', 'ui/html-lobby.html'],
  ['stage',  'body',    'screen', 'ui/html-stage.html'],
  ['modals', 'overlay', 'modal',  'ui/html-modals.html'],
];
for (const [id, slot, type, file] of views) {
  insV.run(id, slot, type, file, readFileSync(join(ROOT, file), 'utf-8'));
}

const insS = db.prepare('INSERT INTO styles VALUES (?,?,?,?)');
for (const f of ['css-base','css-boot','css-lobby','css-stage','css-modals','css-chat']) {
  const file = 'ui/' + f + '.css';
  insS.run(f, f.replace('css-', ''), file, readFileSync(join(ROOT, file), 'utf-8'));
}

// Assemble bundle.js from db
const bundle = db.prepare('SELECT source FROM modules ORDER BY sort_order').all().map(r => r.source).join('\n');
writeFileSync(join(ROOT, 'js', 'bundle.js'), bundle);

const stats = {
  modules: db.prepare('SELECT count(*) as c FROM modules').get().c,
  lines: db.prepare('SELECT sum(lines) as s FROM modules').get().s,
  views: db.prepare('SELECT count(*) as c FROM views').get().c,
  styles: db.prepare('SELECT count(*) as c FROM styles').get().c,
};

console.log(`bundle.db: ${stats.modules} modules (${stats.lines} lines), ${stats.views} views, ${stats.styles} styles`);
console.log(`bundle.js: assembled (${bundle.split('\n').length} lines)`);

db.close();
