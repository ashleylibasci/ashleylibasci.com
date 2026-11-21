// Every island at once: the leaf rule (AD-5), one mount site each, no island
// reaching into another, and no mockup-only markup anywhere in the source
// (AD-14). The island list comes from the folder, so a new island is checked
// the day it lands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const islandsDir = join(src, 'islands');

/** Every file under `dir`, as absolute paths. @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const IMPORT = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/** The specifiers a source imports. @param {string} source */
const specifiers = (source) => [...source.matchAll(IMPORT)].map((match) => match[1] ?? '');

/** The relative specifiers of a file, resolved to absolute paths. @param {string} file */
function resolvedImports(file) {
  return specifiers(readFileSync(file, 'utf8'))
    .filter((spec) => spec.startsWith('.'))
    .map((spec) => resolve(dirname(file), spec));
}

/** The island folder a path sits in, or null. @param {string} path */
function islandOf(path) {
  const rel = relative(islandsDir, path);
  if (rel.startsWith('..') || rel === '') return null;
  return rel.split(sep)[0] ?? null;
}

const islands = readdirSync(islandsDir).filter((name) => statSync(join(islandsDir, name)).isDirectory());
const srcFiles = walk(src);
const codeFiles = srcFiles.filter((file) => /\.(astro|ts|mjs|js|md|mdx)$/.test(file));

test('the island list comes from the folder and holds them all', () => {
  assert.ok(islands.length >= 10, `found ${islands.length}: ${islands.join(', ')}`);
});

test('every island client script imports only files in its own folder', () => {
  for (const name of islands) {
    const files = walk(join(islandsDir, name));
    /** @type {Record<string, string>} */
    const sources = {};
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (file.endsWith('.ts')) sources[relative(src, file)] = text;
      if (file.endsWith('.astro')) {
        [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].forEach((match, i) => {
          sources[`${relative(src, file)} <script> ${i + 1}`] = match[1] ?? '';
        });
      }
    }
    for (const [where, source] of Object.entries(sources)) {
      for (const spec of specifiers(source)) assert.match(spec, /^\.\/[^/]+$/, `${where}: ${spec}`);
    }
  }
});

test('nothing outside the islands imports an island module', () => {
  for (const file of codeFiles) {
    if (islandOf(file)) continue;
    for (const target of resolvedImports(file)) {
      if (!islandOf(target)) continue;
      assert.match(target, /\.astro$/, `${relative(src, file)} imports ${relative(src, target)}`);
    }
  }
});

test('no island imports another island', () => {
  for (const file of codeFiles) {
    const own = islandOf(file);
    if (!own) continue;
    for (const target of resolvedImports(file)) {
      const other = islandOf(target);
      assert.ok(other === null || other === own, `${relative(src, file)} imports ${relative(src, target)}`);
    }
  }
});

test('each island component is mounted from exactly one file', () => {
  for (const name of islands) {
    const components = walk(join(islandsDir, name)).filter((file) => file.endsWith('.astro'));
    assert.ok(components.length >= 1, `${name}: has a component`);
    for (const component of components) {
      const hosts = codeFiles.filter((file) => resolvedImports(file).includes(component));
      assert.equal(hosts.length, 1, `${relative(src, component)}: ${hosts.map((file) => relative(src, file)).join(', ')}`);
      assert.equal(islandOf(hosts[0] ?? ''), null, `${relative(src, component)} is mounted by a page or layout`);
    }
  }
});

test('no mockup-only markup in the source', () => {
  const MOCKUP_ONLY = /data-mockup-only|eg-panel|Easter eggs to review|Jump to bottom/;
  for (const file of srcFiles) {
    const text = readFileSync(file, 'latin1');
    assert.equal(MOCKUP_ONLY.test(text), false, relative(src, file));
  }
});
