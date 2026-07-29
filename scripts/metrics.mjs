#!/usr/bin/env node
/**
 * Regenerates the complexity table in the README.
 *
 * The runtime numbers in this project come from a harness anyone can re-run.
 * The complexity table used to be hand-counted, which made the one table a
 * reader cannot verify the one asserting the project's actual conclusion. This
 * script prints it, and `npm run metrics -- --check` fails if the committed
 * README no longer matches — so the table cannot drift away from the code.
 *
 * Usage:
 *   npm run metrics            print the table
 *   npm run metrics -- --check exit 1 if the README is stale
 */
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APPS = ['zustand', 'rxjs', 'mobx', 'jotai', 'redux'];
const ROOT = new URL('..', import.meta.url).pathname;

/** Non-blank, non-comment lines. Comments are excluded so an implementation is
 *  not penalised for explaining itself — this file's own comments included. */
function sloc(source) {
  let inBlock = false;
  let count = 0;
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line === '') continue;
    if (line.startsWith('//')) continue;
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    count += 1;
  }
  return count;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** The state layer: everything under src/state that is not a test and not a
 *  barrel re-export. The boundary is declared here rather than in prose. */
function stateFiles(app) {
  return walk(join(ROOT, 'apps', app, 'src', 'state'))
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !/\.test\.tsx?$/.test(f))
    .filter((f) => !/\/index\.ts$/.test(f))
    .sort();
}

/**
 * Lines outside src/state that exist only to connect the state layer to React:
 * hook calls, observer() wrappers, store imports. Reported separately because
 * excluding them entirely flatters whichever library pushes work into the
 * screens, and folding them in flatters whichever pushes it into the store.
 */
function screenLines(app) {
  const files = walk(join(ROOT, 'apps', app, 'src'))
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !f.includes(`${'/'}state${'/'}`))
    .filter((f) => !/\.test\.tsx?$/.test(f));
  return files.reduce((sum, f) => sum + sloc(readFileSync(f, 'utf8')), 0);
}

function bundleGzipBytes(app) {
  const assets = join(ROOT, 'apps', app, 'dist', 'assets');
  let total = 0;
  for (const entry of readdirSync(assets)) {
    if (!entry.endsWith('.js')) continue;
    total += gzipSync(readFileSync(join(assets, entry)), { level: 9 }).length;
  }
  return total;
}

function dependencyVersions(app) {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'apps', app, 'package.json'), 'utf8'));
  const installed = (name) => {
    try {
      return JSON.parse(
        readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8'),
      ).version;
    } catch {
      return '?';
    }
  };
  return Object.keys(pkg.dependencies ?? {})
    .filter((name) => !name.startsWith('@smc/') && !name.startsWith('react'))
    .map((name) => `${name}@${installed(name)}`)
    .join(', ');
}

const rows = APPS.map((app) => {
  const files = stateFiles(app);
  return {
    app,
    stateLoc: files.reduce((sum, f) => sum + sloc(readFileSync(f, 'utf8')), 0),
    files: files.length,
    screenLoc: screenLines(app),
    gzipKb: bundleGzipBytes(app) / 1024,
    versions: dependencyVersions(app),
  };
}).sort((a, b) => a.stateLoc - b.stateLoc);

const NAMES = {
  zustand: 'Zustand', rxjs: 'RxJS', mobx: 'MobX', jotai: 'Jotai', redux: 'Redux Toolkit',
};

const table = [
  '| | Bundle (gzip) | State-layer SLOC | Files | Wiring SLOC outside the state layer |',
  '|---|---:|---:|---:|---:|',
  ...rows.map((r) => `| **${NAMES[r.app]}** | ${r.gzipKb.toFixed(1)} kB `
    + `| ${r.stateLoc} | ${r.files} | ${r.screenLoc} |`),
].join('\n');

const versions = rows.map((r) => `${NAMES[r.app]}: ${r.versions}`).join('\n');

if (process.argv.includes('--check')) {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  if (!readme.includes(table)) {
    process.stderr.write(
      'README complexity table is stale. Run `npm run metrics` and paste the table below.\n\n'
      + `${table}\n`,
    );
    process.exit(1);
  }
  process.stdout.write('README complexity table matches the code.\n');
} else {
  process.stdout.write(`${table}\n\nMeasured versions\n${versions}\n`);
  process.stdout.write(`\nnode ${process.version}, `);
  process.stdout.write(`${execFileSync('npx', ['playwright', '--version'], { cwd: ROOT })
    .toString().trim()}\n`);
}
