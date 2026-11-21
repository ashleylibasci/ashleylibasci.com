// The write-up splitter: the lead, the sections and their parts, and the figure rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFigures, figureNames, splitArticle } from '../src/lib/article.ts';

const HTML = [
  '<p>The lead.</p>',
  '<dl><dt>Status</dt><dd>Open</dd></dl>',
  '<h2 id="the-first">The first</h2>',
  '<p>One.</p>',
  '<p>[[figure:nights]] <strong>Figure 1.</strong> A caption with a <a href="/">link</a>.</p>',
  '<p>Two.</p>',
  '<h2>What I\'m &amp; doing</h2>',
  '<h3 id="sub">Sub</h3>',
  '<p>Three.</p>',
].join('\n');

test('a lead, two h2 and a figure paragraph: the lead, then sections with ordered parts', () => {
  assert.deepEqual(splitArticle(HTML), {
    lead: '<p>The lead.</p>\n<dl><dt>Status</dt><dd>Open</dd></dl>',
    leadParts: [{ kind: 'html', html: '<p>The lead.</p>\n<dl><dt>Status</dt><dd>Open</dd></dl>' }],
    sections: [
      {
        id: 'the-first',
        heading: 'The first',
        parts: [
          { kind: 'html', html: '<p>One.</p>' },
          { kind: 'figure', name: 'nights', caption: '<strong>Figure 1.</strong> A caption with a <a href="/">link</a>.' },
          { kind: 'html', html: '<p>Two.</p>' },
        ],
      },
      {
        id: 'what-i-m-doing',
        heading: "What I'm &amp; doing",
        parts: [{ kind: 'html', html: '<h3 id="sub">Sub</h3>\n<p>Three.</p>' }],
      },
    ],
  });
});

test('without an h2, all of it is the lead and there are no sections', () => {
  assert.deepEqual(splitArticle('<p>One.</p>\n<h3>Not a section</h3>\n<p>Two.</p>\n'), {
    lead: '<p>One.</p>\n<h3>Not a section</h3>\n<p>Two.</p>',
    leadParts: [{ kind: 'html', html: '<p>One.</p>\n<h3>Not a section</h3>\n<p>Two.</p>' }],
    sections: [],
  });
  assert.deepEqual(splitArticle(''), { lead: '', leadParts: [], sections: [] });
});

test('a section may hold only a figure, or nothing', () => {
  const { sections } = splitArticle('<h2 id="a">A</h2>\n<p>[[figure:one]]</p>\n<h2 id="b">B</h2>\n');
  assert.deepEqual(sections[0].parts, [{ kind: 'figure', name: 'one', caption: '' }]);
  assert.deepEqual(sections[1].parts, []);
});

test('a marker that does not start its own paragraph throws, naming where', () => {
  assert.throws(() => splitArticle('<h2 id="a">A</h2><p>See [[figure:one]] here.</p>'), /article: .*the section "a"/);
  assert.throws(() => splitArticle('<p>See [[figure:one]] here.</p><h2 id="a">A</h2>'), /article: .*the lead/);
  assert.throws(() => splitArticle('<h2 id="a">A</h2><p>[[figure:Bad Name]] x</p>'), /article: "Bad Name" .*is not a figure name/);
});

test('the lead may place a figure: it is a lead part, and not in the lead HTML', () => {
  const article = splitArticle('<p>Lead.</p>\n<p>[[figure:shot]] Cap.</p>\n<h2>A</h2><p>[[figure:chart]] x</p>');
  assert.equal(article.lead, '<p>Lead.</p>');
  assert.deepEqual(article.leadParts, [
    { kind: 'html', html: '<p>Lead.</p>' },
    { kind: 'figure', name: 'shot', caption: 'Cap.' },
  ]);
  assert.deepEqual(figureNames(article), ['shot', 'chart']);
  // The lead's figures count for the unknown and unused rules.
  assert.throws(() => checkFigures(article, ['chart'], 'the-page'), /the-page: .*unknown figure "shot"/);
  assert.throws(() => checkFigures(splitArticle('<p>Lead.</p><h2>A</h2>'), ['shot'], 'the-page'), /never uses the figure "shot"/);
  assert.doesNotThrow(() => checkFigures(article, ['shot', 'chart'], 'the-page'));
});

test('figureNames lists the figures in order', () => {
  assert.deepEqual(figureNames(splitArticle(HTML)), ['nights']);
  const two = splitArticle('<h2>A</h2><p>[[figure:b-two]] x</p><h2>B</h2><p>[[figure:a]] y</p>');
  assert.deepEqual(figureNames(two), ['b-two', 'a']);
});

test('checkFigures: an unknown figure fails, naming it and the page', () => {
  const article = splitArticle('<h2>A</h2><p>[[figure:nights]] x</p><p>[[figure:nope]] y</p>');
  assert.throws(() => checkFigures(article, ['nights'], 'the-page'), /the-page: .*unknown figure "nope"/);
});

test('checkFigures: a figure the write-up never uses, or uses twice, fails, naming it', () => {
  const article = splitArticle(HTML);
  assert.throws(() => checkFigures(article, ['nights', 'plan-backward'], 'the-page'), /the-page: .*"plan-backward"/);
  const twice = splitArticle('<h2>A</h2><p>[[figure:nights]] x</p><p>[[figure:nights]] y</p>');
  assert.throws(() => checkFigures(twice, ['nights'], 'the-page'), /"nights" 2 times/);
  assert.doesNotThrow(() => checkFigures(article, ['nights'], 'the-page'));
});
