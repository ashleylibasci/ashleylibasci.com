// About page: the skills collection as the mockup lists it, the page reading its facts from
// the collections and CONTACTS, the About and Resume nav items, the Resume section and its
// Placeholder, and the rules the page and its components keep in their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACTS } from '../src/lib/contacts.ts';
import { NAV, navItem } from '../src/lib/nav.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

const page = read('pages', 'about.astro');
const head = read('components', 'PageHead.astro');
const section = read('components', 'ArticleSection.astro');
const placeholder = read('components', 'Placeholder.astro');
const all = [page, head, section, placeholder];

// The skills files as plain text: a label, a list of items, an order. No YAML parser is installed.
const skillsDir = join(src, 'content', 'skills');
const skills = readdirSync(skillsDir)
  .filter((name) => name.endsWith('.yaml'))
  .map((name) => {
    const text = readFileSync(join(skillsDir, name), 'utf8');
    return {
      label: text.match(/^label: (.+)$/m)?.[1],
      items: [...text.matchAll(/^  - (.+)$/gm)].map((match) => match[1]),
      order: Number(text.match(/^order: (\d+)$/m)?.[1]),
    };
  })
  .sort((a, b) => a.order - b.order);

test('the skills collection holds the four rows, in order', () => {
  assert.deepEqual(readdirSync(skillsDir).sort(), ['cloud.yaml', 'frameworks.yaml', 'languages.yaml', 'tools.yaml']);
  assert.deepEqual(
    skills.map((group) => [group.label, group.items.join(', ')]),
    [
      ['Languages', 'Java, Python, C++, Kotlin, Lean'],
      ['Frameworks', 'React, Node.js, Next.js'],
      ['Cloud', 'AWS (Amplify, Route 53)'],
      ['Tools', 'GitHub, Claude Code, BMAD, VS Code, Xcode, Wireshark, Linux'],
    ],
  );
  assert.deepEqual(skills.map((group) => group.order), [1, 2, 3, 4]);
});

test('Skills render from the collection, sorted by order; an empty collection fails the build', () => {
  assert.match(page, /\(await getCollection\('skills'\)\)\.map\(\(\{ data \}\) => data\)\.sort\(\(a, b\) => a\.order - b\.order\)/);
  assert.match(page, /if \(skills\.length === 0\) throw new Error\(/);
  assert.match(page, /skills\.map\(\(group\) => \(<Fragment><dt>\{group\.label\}<\/dt><dd>\{group\.items\.join\(', '\)\}<\/dd><\/Fragment>\)\)/);
  // No row is retyped in the page or a component.
  for (const group of skills) {
    for (const text of all) {
      assert.equal(text.includes(`<dt>${group.label}</dt>`), false, group.label);
      assert.equal(text.includes(group.items.join(', ')), false, group.label);
    }
  }
});

test('Education renders from the one education entry, the dates through format.ts', () => {
  assert.match(page, /getCollection\('experience'\)\)\.flatMap\(\(\{ data \}\) => \(data\.kind === 'education' \? \[data\] : \[\]\)\)/);
  assert.match(page, /if \(schools\.length !== 1\) throw new Error\(/);
  assert.match(page, /<dt>School<\/dt><dd>\{school\.school\}<\/dd>\s*<dt>Degree<\/dt><dd>\{school\.degree\}<\/dd>\s*<dt>Minor<\/dt><dd>\{school\.minor\}<\/dd>\s*<dt>Dates<\/dt><dd>\{formatRange\(school\.start, school\.end\)\}<\/dd>/);
  assert.match(page, /<dt>Coursework<\/dt><dd>Listed on my <a href=\{experience\.href\}>\{experience\.label\}<\/a> page<\/dd>/);
  for (const fact of ['University of Illinois', 'B.S.', 'Statistics', '2025', '2028', '3.88']) {
    assert.equal(page.includes(fact), false, fact);
  }
});

test('Contact shows the three public contacts from CONTACTS and nothing else', () => {
  assert.deepEqual(Object.keys(CONTACTS), ['email', 'github', 'linkedin']);
  assert.match(page, /<dt>Email<\/dt><dd><a href=\{`mailto:\$\{CONTACTS\.email\}`\}>\{CONTACTS\.email\}<\/a><\/dd>/);
  assert.match(page, /<dt>LinkedIn<\/dt><dd><a href=\{CONTACTS\.linkedin\}>\{shown\(CONTACTS\.linkedin\)\}<\/a><\/dd>/);
  assert.match(page, /<dt>GitHub<\/dt><dd><a href=\{CONTACTS\.github\}>\{shown\(CONTACTS\.github\)\}<\/a><\/dd>/);
  // The shown form drops the scheme and "www.", as the page's own rule does.
  const rule = page.match(/const shown = \(url: string\) => url\.replace\((\/.+\/), ''\);/)?.[1];
  assert.ok(rule);
  const shown = (/** @type {string} */ url) => url.replace(new RegExp(rule.slice(1, -1)), '');
  assert.equal(shown(CONTACTS.linkedin), 'linkedin.com/in/ashleylibasci');
  assert.equal(shown(CONTACTS.github), 'github.com/ashleylibasci');
  for (const text of all) assert.equal(/https?:\/\/|@illinois|linkedin\.com|github\.com/.test(text), false);
});

test('the copy is the mockup\'s: greeting, standfirst, Now, the Resume line', () => {
  assert.match(page, /title="Hi, I'm Ashley\."/);
  assert.match(page, /standfirst="I like problems where the answer can be checked, like a model tested against ten years of labor data or a proof Lean verifies line by line\."/);
  assert.match(page, /<p>This fall I'm researching machine-written proofs at the Illinois Mathematics Lab and building the Health Dashboard, a sleep and recovery app for iPhone and Apple Watch, on its way to TestFlight\. This summer I was a cybersecurity intern at Baxter Credit Union and built Career Star\. I'm looking for 2027 internships in software engineering, cybersecurity and quant\.<\/p>/);
  assert.match(page, /<p>One page, updated November 2026\.<\/p>/);
  assert.deepEqual(
    [...page.matchAll(/<ArticleSection id="[a-z-]+" heading=(?:"([^"]+)"|\{resume\.label\})/g)].map((match) => match[1] ?? navItem('resume').label),
    ['Now', 'Education', 'Skills', 'Contact', 'Resume'],
  );
});

test('About and Resume close the nav; About is current on the page and Resume never is', () => {
  assert.deepEqual(
    NAV.map((item) => item.key),
    ['home', 'work', 'research', 'experience', 'about', 'resume'],
  );
  assert.deepEqual(navItem('about'), { key: 'about', label: 'About', href: '/about', tab: true });
  assert.deepEqual(navItem('resume'), { key: 'resume', label: 'Resume', href: '/about#resume', tab: true });
  assert.match(page, /const page = navItem\('about'\);/);
  assert.match(page, /<Base title=\{page\.label\} section=\{page\.key\}>/);
  assert.match(page, /current=\{page\.label\}/);
  // No page passes the Resume key as its section, so the item is never marked current.
  for (const name of readdirSync(join(src, 'pages'))) {
    assert.equal(/navItem\('resume'\)\.key|section="resume"/.test(read('pages', name)), false, name);
  }
  assert.equal(/section=\{resume/.test(page), false);
  // Every nav item points at a page that exists.
  for (const item of NAV) {
    const path = item.href.replace(/#.*$/, '').replace(/^\//, '') || 'index';
    assert.ok(existsSync(join(src, 'pages', `${path}.astro`)), item.href);
  }
});

test('the Resume section sits at the nav item\'s fragment and clears the sticky bar', () => {
  assert.match(page, /const \[resumePath, resumeAnchor\] = resume\.href\.split\('#'\);/);
  assert.match(page, /if \(resumePath !== page\.href \|\| !resumeAnchor\) throw new Error\(/);
  assert.match(page, /<ArticleSection id="resume-heading" heading=\{resume\.label\} anchor=\{resumeAnchor\}>/);
  assert.match(section, /<section class="g12" id=\{anchor\} tabindex=\{anchor \? -1 : undefined\} aria-labelledby=\{anchor \? id : undefined\}>/);
  assert.match(section, /section\[id\] \{\s*scroll-margin-top: var\(--nav\);/);
  // Chosen in the Menu sheet on this page, the link is a same-page jump: the sheet shuts on any link.
  assert.match(read('islands', 'menu-sheet', 'menu-sheet.ts'), /if \(target instanceof Element && target\.closest\('a'\)\) close\(false\);/);
});

test('the Placeholder: the designed dashed box with the approved line', () => {
  assert.match(page, /<Placeholder>The resume PDF and its download link go here\.<\/Placeholder>/);
  assert.match(placeholder, /\.placeholder \{[^}]*max-width: 42em;\s*padding: var\(--space-5\);\s*border: 1px dashed var\(--color-line-2\);\s*border-radius: var\(--radius-md\);\s*color: var\(--color-ink-3\);/);
  // No resume file and no download link yet.
  assert.equal(/\.pdf|download=/.test(page), false);
});

test('every PageHead crumb links to its page; the Experience Resume link is always rendered', () => {
  assert.match(head, /crumbs\.map\(\(step\) => \(\s*<Fragment>\s*<a href=\{step\.href\}>\{step\.label\}<\/a>\s*\{' \/ '\}/);
  assert.equal(/<span>\{step\.label\}<\/span>/.test(head), false);
  const experience = read('pages', 'experience.astro');
  assert.match(experience, /const resumeHref = '\/about#resume';/);
  assert.match(experience, /<Fragment slot="links"><a href=\{resumeHref\}>Resume<\/a><\/Fragment>/);
});

test('the About head: the framed headshot through FramedImage, lazy, left of the greeting', () => {
  for (const text of all) assert.equal(/<img\b/.test(text), false);
  assert.match(page, /<Fragment slot="photo">\s*<PrintFrame class="pic">\s*<FramedImage\s+src=\{headshot\}\s+alt="Ashley Libasci"/);
  assert.match(page, /sizes="\(max-width: 760px\) 116px, clamp\(148px, 11\.4vw, 166px\)"/);
  assert.equal(/\beager\b/.test(page), false);
  assert.match(page, /\.pic \{\s*--pw: clamp\(148px, 11\.4vw, 166px\);/);
  assert.match(page, /@media \(max-width: 760px\) \{\s*\.pic \{\s*--pw: 116px;/);
  assert.match(head, /\{photo && <Fragment set:html=\{photo\} \/>\}\s*<div class="text">/);
  assert.match(head, /\.with-photo \{\s*display: flex;\s*align-items: center;\s*gap: 44px;/);
  assert.match(head, /@media \(max-width: 760px\) \{\s*\.with-photo \{\s*flex-direction: column;\s*align-items: flex-start;\s*gap: var\(--space-5\);/);
  assert.match(head, /<h1 id="page-heading" tabindex="-1">\{title\}<\/h1>/);
});

test('none of the cut lines and no phone number', () => {
  // Matched by fragments, so no cut line is written out here.
  for (const text of all) {
    assert.equal(/is encouraged|gets written at|my own bedtime/i.test(text), false);
    assert.equal(/\d{3}[\s.-]\d{3}[\s.-]\d{4}|\btel:/.test(text), false);
  }
});

test('no client script, no hover motion and no color value outside the tokens', () => {
  for (const text of all) {
    assert.equal(/<script/.test(text), false);
    assert.equal(/transform|transition|animation/.test(text), false);
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(text), false);
  }
});
