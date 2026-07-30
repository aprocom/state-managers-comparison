#!/usr/bin/env vite-node
/**
 * Assembles the GitHub Pages site from the five built apps.
 *
 * The switcher is injected here rather than added to the apps, and that is the
 * whole point of doing it this way: `apps/<name>/src` is what the complexity
 * table measures and what the parity suites drive. Demo scaffolding inside it
 * would be counted against whichever library happened to host it and would give
 * every implementation a testid the gate never agreed on. So the apps stay
 * exactly as the benchmark found them and the site is built around them.
 *
 * Usage: npm run build:site   (run `npm run build:apps` first)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_TARGETS } from '../packages/bench/src/apps';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = join(ROOT, 'site');

const LABELS: Record<string, string> = {
  zustand: 'Zustand', rxjs: 'RxJS', mobx: 'MobX', jotai: 'Jotai', redux: 'Redux Toolkit',
};

const SWITCHER_CSS = `
.smc-switcher{position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;
gap:.5rem;align-items:center;flex-wrap:wrap;padding:.5rem .75rem;
background:#0d1117;border-top:1px solid #222b35;
font:13px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.smc-switcher a{color:#b7c1cc;text-decoration:none;padding:.2rem .55rem;
border:1px solid #222b35;border-radius:5px}
.smc-switcher a:hover{color:#fff;border-color:#3d4b5a}
.smc-switcher a[aria-current]{color:#0d1117;background:#d2b46d;border-color:#d2b46d}
.smc-switcher .smc-label{color:#7d8b99;margin-right:.25rem}
.smc-switcher .smc-home{margin-left:auto}
body{padding-bottom:3.25rem}
`.replace(/\n/g, '');

function switcher(current: string): string {
  const links = APP_TARGETS.map((t) => {
    const label = LABELS[t.name] ?? t.name;
    const here = t.name === current ? ' aria-current="page"' : '';
    return `<a href="../${t.name}/"${here}>${label}</a>`;
  }).join('');
  return `<style>${SWITCHER_CSS}</style>`
    + `<nav class="smc-switcher"><span class="smc-label">Same app, five state layers:</span>`
    + `${links}<a class="smc-home" href="../">About this demo</a></nav>`;
}

function landing(): string {
  const cards = APP_TARGETS.map((t) => {
    const label = LABELS[t.name] ?? t.name;
    return `<li><a href="./${t.name}/"><strong>${label}</strong>`
      + `<span>apps/${t.name}</span></a></li>`;
  }).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>State Managers Comparison — live demos</title>
<style>
:root{color-scheme:dark}
body{margin:0;padding:3rem 1.5rem;background:#0b0f14;color:#d9e2ec;
font:16px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:56rem;margin:0 auto}
h1{font-size:2rem;margin:0 0 .5rem}
p{color:#b7c1cc;max-width:44rem}
a{color:#d2b46d}
ul{list-style:none;display:grid;gap:.75rem;padding:0;margin:2rem 0;
grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))}
ul a{display:flex;flex-direction:column;gap:.15rem;padding:.9rem 1rem;
background:#111820;border:1px solid #222b35;border-radius:8px;
text-decoration:none;color:#fff}
ul a:hover{border-color:#3d4b5a}
ul span{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#7d8b99}
.note{border-left:3px solid #d2b46d;padding:.4rem 0 .4rem 1rem;margin:2rem 0}
footer{margin-top:3rem;color:#7d8b99;font-size:14px}
</style></head>
<body><main>
<h1>State Managers Comparison</h1>
<p>One React trading terminal, built five times. Everything except the state
layer is shared — domain types, all P&amp;L and statistics maths, every
presentational component — and a cross-app suite requires all five to produce
an identical derived-state vector before any of them is measured.</p>
<p>These are those five builds, running the same seeded quote feed you can
switch between 10, 100 and 1000 updates per second.</p>
<ul>${cards}</ul>
<div class="note">
<p><strong>Watching these is not benchmarking them.</strong> Your browser is
running one app at a time, on an unknown machine, with an unknown amount of
other work happening. The published numbers come from a harness that interleaves
the implementations, discards a warm-up, takes ten samples per cell and reports
a confidence interval for every median — and that harness still says the only
axis on which anything separates is main-thread CPU. Nothing you can see here
distinguishes them; that is itself the result.</p>
</div>
<footer>
<a href="https://github.com/aprocom/state-managers-comparison">Source, methodology and full results on GitHub</a>
</footer>
</main></body></html>
`;
}

if (existsSync(SITE)) rmSync(SITE, { recursive: true });
mkdirSync(SITE, { recursive: true });

for (const target of APP_TARGETS) {
  const dist = join(ROOT, 'apps', target.name, 'dist');
  if (!existsSync(dist)) {
    throw new Error(`${dist} is missing — run \`npm run build:apps\` first`);
  }
  const out = join(SITE, target.name);
  cpSync(dist, out, { recursive: true });

  const indexPath = join(out, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  if (!html.includes('</body>')) throw new Error(`${indexPath} has no </body> to inject into`);
  writeFileSync(indexPath, html.replace('</body>', `${switcher(target.name)}</body>`));
}

writeFileSync(join(SITE, 'index.html'), landing());
// Pages runs Jekyll over the artifact unless told not to; underscore-prefixed
// asset names would be dropped silently.
writeFileSync(join(SITE, '.nojekyll'), '');

process.stdout.write(`site/ built: ${APP_TARGETS.length} apps + landing page\n`);
