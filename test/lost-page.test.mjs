// Lost page (404): the approved copy, the title as focus target, the one link home, the
// document title, no current tab, and the rules the page keeps in its source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV, SITE_NAME, navItem } from '../src/lib/nav.ts';
import { pageRoutes } from '../src/lib/route-match.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'src', 'pages', '404.astro'), 'utf8');
const [, frontmatter, body] = page.split(/^---$/m);
const markup = body.split('<style>')[0];

test('the page file is 404.astro, so the build writes dist/404.html', () => {
  assert.ok(readdirSync(join(root, 'src', 'pages')).includes('404.astro'));
  assert.match(readFileSync(join(root, 'astro.config.mjs'), 'utf8'), /build: \{ format: 'file' \}/);
  assert.ok(pageRoutes(['../pages/404.astro']).has('/404'));
});

test('the copy is the two approved lines and the link home, word for word', () => {
  assert.match(markup, /<h1 id="page-heading" tabindex="-1">This page swam off\.<\/h1>/);
  assert.match(markup, /<p class="standfirst">It isn't here, but everything else is\.<\/p>/);
  assert.match(markup, /<a href=\{home\.href\}>Back to the home page<\/a>/);
  // Nothing else is said on the page.
  const words = markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(words, "This page swam off. It isn't here, but everything else is. Back to the home page");
});

test('one link, to the home page; one h1, the skip-link and page-load focus target', () => {
  assert.equal(markup.match(/<a\b/g)?.length, 1);
  assert.match(frontmatter, /const home = navItem\('home'\);/);
  assert.equal(navItem('home').href, '/');
  assert.equal(markup.match(/<h1\b/g)?.length, 1);
  assert.match(readFileSync(join(root, 'src', 'layouts', 'Base.astro'), 'utf8'), /<a class="skip" href="#page-heading">/);
  assert.match(readFileSync(join(root, 'src', 'islands', 'page-focus', 'page-focus.ts'), 'utf8'), /getElementById\('page-heading'\)/);
});

test('the document title is "Not found · Ashley Libasci" and no tab is current', () => {
  assert.match(markup, /<Base title="Not found">/);
  assert.equal(SITE_NAME, 'Ashley Libasci');
  assert.match(readFileSync(join(root, 'src', 'layouts', 'Base.astro'), 'utf8'), /title \? `\$\{title\} · \$\{SITE_NAME\}` : SITE_NAME/);
  assert.equal(/section=/.test(markup), false);
  // The page has no nav item of its own.
  assert.equal(NAV.some((item) => item.href.startsWith('/404') || /not found|lost/i.test(item.label)), false);
});

test('the layout: centered between the bar and the footer, a row that stacks on phones', () => {
  assert.match(page, /\.lost \{[^}]*min-height: calc\(100svh - var\(--nav\) - var\(--foot\)\);\s*display: flex;\s*align-items: center;/);
  assert.match(page, /\.lost-in \{\s*display: flex;\s*align-items: center;\s*gap: 44px;/);
  assert.match(page, /h1 \{\s*font: var\(--type-page-title\);\s*font-size: clamp\(40px, 4\.3vw, 60px\);/);
  assert.match(page, /\.lost \{[^}]*padding-top: var\(--space-8\);\s*padding-bottom: var\(--space-8\);/);
  assert.match(page, /\.links \{\s*margin-top: var\(--space-5\);/);
  // The phone touch area is inline padding, so it moves no line.
  assert.match(page, /\.links a \{\s*padding: 13px 0;\s*\}/);
  assert.match(page, /@media \(max-width: 760px\) \{\s*\.lost-in \{\s*flex-direction: column;\s*align-items: flex-start;\s*gap: var\(--space-5\);/);
});

test('no script, no image, no drawing, no color values, no cut lines, no phone number', () => {
  assert.equal(/<script\b|<img\b|<svg\b|client:/.test(page), false);
  assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(page), false);
  assert.equal(/Touching is encouraged|1 a\.m\.|bedtime/.test(page), false);
  assert.equal(/\d{3}[-. ]\d{3}[-. ]\d{4}/.test(page), false);
  assert.equal(/\b(?:he|she|his|her|him|hers)\b/i.test(markup), false);
});
