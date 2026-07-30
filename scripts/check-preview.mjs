#!/usr/bin/env node
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const svgPath = resolve('assets/social-preview.svg');
const svgSource = readFileSync(svgPath, 'utf8');

const canvas = { width: 1280, height: 640 };
const plot = { x: 324, width: 560, vMax: 90 };
const rows = { top: 306, height: 39, barOffsetY: 5, barHeight: 16 };
const card = { x: 64, y: 206, width: 1152, height: 340 };
const epsilon = 1;

// The overlap and in-canvas predicates live inside page.evaluate below, not
// here: that callback is serialised into the browser and cannot close over
// anything in this module's scope.

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--single-process', '--disable-gpu', '--disable-dev-shm-usage'],
  timeout: 20_000,
});
const page = await browser.newPage({ viewport: canvas });
page.setDefaultTimeout(10_000);
await page.setContent(svgSource, { waitUntil: 'load', timeout: 10_000 });

const result = await page.evaluate(({ canvas, plot, rows, card, epsilon }) => {
  const fail = [];
  const svg = document.querySelector('svg');
  if (svg === null) throw new Error('SVG root not found');

  const attrWidth = Number(svg.getAttribute('width'));
  const attrHeight = Number(svg.getAttribute('height'));
  if (attrWidth !== canvas.width || attrHeight !== canvas.height) {
    fail.push(`canvas is ${attrWidth}x${attrHeight}, expected ${canvas.width}x${canvas.height}`);
  }

  const svgRect = svg.getBoundingClientRect();
  const toBox = (el) => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.trim() ?? '',
      dataName: el.getAttribute('data-name') ?? '',
      dataRole: el.getAttribute('data-role') ?? '',
      left: rect.left - svgRect.left,
      top: rect.top - svgRect.top,
      right: rect.right - svgRect.left,
      bottom: rect.bottom - svgRect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const inside = (box) => box.left >= -epsilon
    && box.top >= -epsilon
    && box.right <= canvas.width + epsilon
    && box.bottom <= canvas.height + epsilon;

  const nodes = [...document.querySelectorAll('text, rect')].map(toBox);
  for (const box of nodes) {
    if (!inside(box)) {
      fail.push(`${box.tag} "${box.text || box.dataName}" outside canvas: ${JSON.stringify(box)}`);
    }
  }

  const drawn = [...document.querySelectorAll('rect, text, line, circle, path')]
    .filter((node) => node.closest('defs') === null)
    .map(toBox);
  for (const box of drawn) {
    if (!inside(box)) {
      fail.push(`${box.tag} "${box.text || box.dataName}" outside canvas: ${JSON.stringify(box)}`);
    }
  }

  const texts = [...document.querySelectorAll('text')].map(toBox);
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i];
      const b = texts[j];
      const overlaps = a.left < b.right
        && a.right > b.left
        && a.top < b.bottom
        && a.bottom > b.top;
      if (overlaps) {
        fail.push(`text overlap: "${a.text}" with "${b.text}"`);
      }
    }
  }

  const bars = [...document.querySelectorAll('rect[data-role="bar"]')];
  for (const [index, bar] of bars.entries()) {
    const value = Number(bar.getAttribute('data-value'));
    const expected = plot.width * value / plot.vMax;
    const actual = bar.getBBox().width;
    if (Math.abs(actual - expected) > epsilon) {
      fail.push(`${bar.getAttribute('data-name')} bar width ${actual.toFixed(2)}, expected ${expected.toFixed(2)}`);
    }
    const expectedY = rows.top + index * rows.height + rows.barOffsetY;
    const actualY = Number(bar.getAttribute('y'));
    const actualHeight = Number(bar.getAttribute('height'));
    if (Math.abs(actualY - expectedY) > epsilon || Math.abs(actualHeight - rows.barHeight) > epsilon) {
      fail.push(`${bar.getAttribute('data-name')} row geometry y=${actualY}, h=${actualHeight}; expected y=${expectedY}, h=${rows.barHeight}`);
    }
    if (actualY + actualHeight > card.y + card.height - 20) {
      fail.push(`${bar.getAttribute('data-name')} bar bottom exceeds chart card safe area`);
    }
  }

  for (const ci of document.querySelectorAll('line[data-role="ci"]')) {
    const low = Number(ci.getAttribute('data-low'));
    const high = Number(ci.getAttribute('data-high'));
    const expectedX1 = plot.x + plot.width * low / plot.vMax;
    const expectedX2 = plot.x + plot.width * high / plot.vMax;
    const actualX1 = Number(ci.getAttribute('x1'));
    const actualX2 = Number(ci.getAttribute('x2'));
    if (Math.abs(actualX1 - expectedX1) > epsilon || Math.abs(actualX2 - expectedX2) > epsilon) {
      fail.push(`${ci.getAttribute('data-name')} CI [${actualX1.toFixed(2)}, ${actualX2.toFixed(2)}], expected [${expectedX1.toFixed(2)}, ${expectedX2.toFixed(2)}]`);
    }
  }

  for (const tick of document.querySelectorAll('line[data-tick]')) {
    const value = Number(tick.getAttribute('data-tick'));
    const expected = plot.x + plot.width * value / plot.vMax;
    const actual = Number(tick.getAttribute('x1'));
    if (Math.abs(actual - expected) > epsilon) {
      fail.push(`tick ${value} x=${actual.toFixed(2)}, expected ${expected.toFixed(2)}`);
    }
  }

  return { fail, checked: { nodes: nodes.length, drawn: drawn.length, texts: texts.length, bars: bars.length } };
}, {
  canvas, plot, rows, card, epsilon,
});

void browser.close().catch(() => {});

if (result.fail.length > 0) {
  console.error(result.fail.join('\n'));
  process.exit(1);
}

console.log(`preview geometry ok: ${result.checked.bars} bars, ${result.checked.nodes} text/rect boxes, ${result.checked.drawn} drawn boxes, ${result.checked.texts} text boxes`);
process.exit(0);
