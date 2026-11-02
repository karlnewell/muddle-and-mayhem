#!/usr/bin/env node
// Guard: the simulation must compute identical results in every JavaScript
// engine, so src/sim may use only arithmetic that IEEE 754 pins down exactly.
//
// Allowed:  + - * /  Math.sqrt  Math.floor  Math.abs  Math.min  Math.max
//           Math.imul  integer bit operators  comparisons
// Banned:   transcendental Math functions, the ** operator, Math.random, and
//           anything that reads the clock or the browser (Date, performance,
//           document, window). Sim code may not import from render, input,
//           or ui either.
//
// Usage: node scripts/check-sim-math.mjs [dir]   (dir defaults to src/sim)
// Exits 1 and prints "file:line: token" for each offence; exits 0 otherwise.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BANNED =
  /\bMath\.(sin|cos|tan|atan|atan2|asin|acos|sinh|cosh|tanh|pow|exp|expm1|log|log1p|log2|log10|random|hypot|cbrt)\b|\*\*|\bDate\b|\bperformance\b|\bdocument\b|\bwindow\b/g;

// An import whose path crosses into the renderer, input, or UI layers.
const FORBIDDEN_IMPORT = /\b(?:from|import)\s*\(?\s*['"][^'"]*\/(render|input|ui)(?:\/|['"])/g;

/**
 * Replace every comment with spaces, keeping newlines so that line numbers
 * in the stripped text match the original.
 *
 * ponytail: this scanner does not understand string or template literals, so
 * a "//" or "/*" inside a string is treated as a comment start. Sim code has
 * no reason to contain such strings; if one appears, split or escape it.
 */
export function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      }
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/**
 * @param {string} source
 * @param {string} filename
 * @returns {Array<{ file: string; line: number; token: string }>}
 */
export function findViolations(source, filename) {
  const violations = [];
  const lines = stripComments(source).split('\n');
  lines.forEach((text, index) => {
    const line = index + 1;
    for (const match of text.matchAll(BANNED)) {
      violations.push({ file: filename, line, token: match[0] });
    }
    for (const match of text.matchAll(FORBIDDEN_IMPORT)) {
      violations.push({ file: filename, line, token: `import from ${match[1]}` });
    }
  });
  return violations;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|mts|js|mjs)$/.test(entry) && !/\.d\.m?ts$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const dir = process.argv[2] ?? 'src/sim';
  let isDir = false;
  try {
    isDir = statSync(dir).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) {
    // Nothing to check yet (Plan 1 has only rng.ts; the folder may not exist in a fresh branch).
    process.exit(0);
  }
  const violations = walk(dir).flatMap((file) => findViolations(readFileSync(file, 'utf8'), file));
  for (const v of violations) {
    console.error(`${v.file}:${v.line}: ${v.token}`);
  }
  process.exit(violations.length === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
