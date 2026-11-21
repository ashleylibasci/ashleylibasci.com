// Console hello: the pure core for the text and styles, then checks on the
// source, the carrier markup and the Base mount.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GREETING, LEAD, helloArgs } from '../src/islands/console-hello/hello-core.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const island = join(src, 'islands', 'console-hello');
/** @param {...string} parts */
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const URL = 'https://github.com/ashleylibasci';
// Hashed names like the built site's, which the devtools console never loads.
const DISPLAY = 'Marcellus-9314a185bf3401c2,"Marcellus-9314a185bf3401c2 fallback: Times New Roman",serif';
const BODY_FONT = '"Albert Sans-fecf326f51684b39","Albert Sans-fecf326f51684b39 fallback: Arial",sans-serif';
const TOKENS = { display: ` ${DISPLAY}`, body: ` ${BODY_FONT}`, teal: ' #2a8f88' };
const EMPTY = { display: '', body: '', teal: '' };

test('the exact two lines and the link in one format string with three %c', () => {
  assert.equal(GREETING, 'Hi! Nice to see you.');
  assert.equal(LEAD, 'Go check out my project code at ');
  const [format] = helloArgs(URL, TOKENS);
  assert.equal(format, '%cHi! Nice to see you.\n%cGo check out my project code at %chttps://github.com/ashleylibasci');
  assert.equal([...format.matchAll(/%c/g)].length, 3);
  assert.equal(helloArgs(URL, TOKENS).length, 4);
});

test('styles with tokens: plain family first, hashed token after; display greeting, body line 2, teal underlined link, no colour on text', () => {
  const [, greeting, line, link] = helloArgs(URL, TOKENS);
  assert.ok(greeting.startsWith('font-family:Marcellus,'), greeting);
  assert.ok(line.startsWith('font-family:"Albert Sans",'), line);
  assert.ok(link.startsWith('font-family:"Albert Sans",'), link);
  assert.equal(greeting, `font-family:Marcellus,${DISPLAY};font-size:15px;line-height:1.6`);
  assert.equal(line, `font-family:"Albert Sans",${BODY_FONT};font-size:13px;line-height:1.6`);
  assert.equal(link, `font-family:"Albert Sans",${BODY_FONT};font-size:13px;line-height:1.6;color:#2a8f88;text-decoration:underline`);
  assert.equal(/color/.test(greeting), false);
  assert.equal(/color/.test(line), false);
});

test('styles with empty tokens: plain names then generic fonts, no colour declaration, text still there', () => {
  const [format, greeting, line, link] = helloArgs(URL, EMPTY);
  assert.match(format, /Hi! Nice to see you\./);
  assert.equal(greeting, 'font-family:Marcellus,serif;font-size:15px;line-height:1.6');
  assert.equal(line, 'font-family:"Albert Sans",sans-serif;font-size:13px;line-height:1.6');
  assert.equal(link, 'font-family:"Albert Sans",sans-serif;font-size:13px;line-height:1.6;text-decoration:underline');
  assert.equal(/color/.test(link), false);
});

test('Base mounts the hello once, last in body, with the GitHub link from contacts', () => {
  const base = read('layouts', 'Base.astro');
  assert.match(base, /import \{ CONTACTS \} from '\.\.\/lib\/contacts';/);
  assert.match(base, /import ConsoleHello from '\.\.\/islands\/console-hello\/ConsoleHello\.astro';/);
  assert.equal([...base.matchAll(/<ConsoleHello /g)].length, 1);
  assert.match(base, /<ConsoleHello href=\{CONTACTS\.github\} \/>\s*<\/body>/);
  assert.equal([...base.matchAll(/<script/g)].length, 1);
});

test('carrier: one hidden span with the link as data only, the script, no styles', () => {
  const source = read('islands', 'console-hello', 'ConsoleHello.astro');
  assert.match(source, /<span hidden data-console-hello data-href=\{href\}><\/span>/);
  assert.equal([...source.matchAll(/<span /g)].length, 1);
  assert.equal(/\shref=|<a[\s>]|tabindex/.test(source), false);
  assert.match(source, /<script>\s*import '\.\/console-hello\.ts';\s*<\/script>/);
  assert.equal(/<style/.test(source), false);
});

test('the client script imports nothing outside its own folder', () => {
  const component = read('islands', 'console-hello', 'ConsoleHello.astro');
  const scripts = [...component.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? '');
  assert.equal(scripts.length, 1);
  const sources = {
    'hello-core.ts': readFileSync(join(island, 'hello-core.ts'), 'utf8'),
    'console-hello.ts': readFileSync(join(island, 'console-hello.ts'), 'utf8'),
    script: scripts[0] ?? '',
  };
  let seen = 0;
  for (const [file, source] of Object.entries(sources)) {
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      assert.match(match[1] ?? '', /^\.\/[^/]+$/, `${file}: ${match[1]}`);
      seen += 1;
    }
  }
  assert.ok(seen >= 2, 'the script and the leaf each import from the folder');
  assert.equal(/\bdocument\.|\bwindow\.|getComputedStyle\(|console\.\w+\(/.test(sources['hello-core.ts']), false, 'the core has no DOM');
});

test('no colour outside the tokens', () => {
  for (const file of ['ConsoleHello.astro', 'console-hello.ts', 'hello-core.ts']) {
    const source = read('islands', 'console-hello', file);
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(source), false, file);
  }
});

test('one console.log in try/catch, reading the three tokens, with no listener or global', () => {
  const script = read('islands', 'console-hello', 'console-hello.ts');
  assert.equal([...script.matchAll(/console\.\w+\(/g)].length, 1);
  assert.match(script, /console\.log\(/);
  assert.match(script, /^try \{[\s\S]*console\.log\([\s\S]*\} catch \{/m);
  for (const name of ['--font-display', '--font-body', '--color-egg-teal']) assert.ok(script.includes(`'${name}'`), name);
  assert.match(script, /getComputedStyle\(document\.documentElement\)/);
  assert.match(script, /if \(href\) \{/);
  for (const file of ['console-hello.ts', 'hello-core.ts', 'ConsoleHello.astro']) {
    const source = read('islands', 'console-hello', file);
    assert.equal(/addEventListener|window\.__|\bwindow\.|onload|beacon|analytics|gtag|track\(/i.test(source), false, file);
  }
});
