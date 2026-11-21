---
title: Career Star
printName: Career Star
timelineName: Built Career Star
start: 2026-05-01
status: live
href: /career-star
summary: One 0–100 risk-adjusted score for each of about 730 U.S. occupations, built on O*NET data and back-tested against what really happened from 2014 to 2024. I presented it to Capital One in August.
stack:
  - Next.js
  - TypeScript
  - AWS Amplify
order: 2
liveUrl: https://careerstar.ashleylibasci.com
print:
  meta: '{since} · live app'
  label: 'Career Star, {since}, live app'
work:
  tag: '{range} · {status} · {stack}'
  linkLabel: Read the case study
---

Every U.S. occupation gets one 0–100 risk-adjusted score, the way an analyst would rate a stock. I started it in May 2026, tested whether it would have been right in the past, and presented it to Capital One in August.

[[figure:rating]] The rating page for one career. Return is growth plus pay, resilience is how shielded the work is from AI, and fit is how well it matches the interests you give.

## The problem

Most career advice I found was either general encouragement or a single salary number. I wanted a way to compare careers the way you'd compare stocks: expected return, risk, and how well each one fits the person asking.

## My role

My own project, start to finish. I designed the scoring model, built the app, and set up hosting on AWS Amplify with Route 53, with CI through GitHub and a 35-test automated suite. I built it spec-first with Claude Code and BMAD: the PRD and the architecture came before any code. It grew out of a stock recommendation project I did in Intro to CS I Honors. In August 2026 I gave a 15-minute presentation on it to Capital One.

## How a career is scored

Growth and pay are percentile ranks across all \~730 careers from Bureau of Labor Statistics and O\*NET data, so every input sits between 0 and 1. Risk discounts return, and fit is blended in last.

<div class="math" role="group" aria-label="Scoring formula">
  <div><i>Return</i> = 0.5 · growth + 0.5 · pay</div>
  <div><i>Risk</i> = 0.7 · AI exposure + 0.3 · volatility</div>
  <div><i>RAV</i> = <i>Return</i> · (1 − 0.6 · <i>Risk</i>)<span class="n">risk-adjusted value</span></div>
  <div><i>Score</i> = 100 · (0.7 · <i>RAV</i> + 0.3 · <i>Fit</i>)</div>
</div>

## Decisions and trade-offs

- **The model does the math, the language model only explains.** A deterministic model computes every number. Claude Haiku writes the plain-English summary, so a score can't change because a model phrased something differently.
- **Free text never reaches the language model.** What you type is matched locally, and requests are rate limited.
- **Publish the misses.** A back-test only means something if the failures are visible, so the ones it got wrong are listed by name.

## Did it work?

I recovered the 2014 edition of the labor data from the Internet Archive, scored that market with today's model, and compared the ranking with what actually happened by 2024. Across 647 occupations the rank correlation was <span class="num">ρ = 0.39</span>, and the careers it flagged as risky really did decline more often than chance: <mark class="num">1.45× as often</mark>.

[[figure:flagged]] **Figure 1.** Of the occupations that really declined between 2014 and 2024, the share each method flagged in 2014. The dashed line is the base rate.

I also moved every weight ±20% on a three-level grid, 3<sup>6</sup> = 729 weightings in all, and the ranking held. When the top two careers are close, the app says it's a close call instead of overselling a shaky first place.

## What it got wrong

In 2014 the model liked oil-and-gas jobs, and then the oil crash happened. No occupation-level model sees a shock like that coming, so I list the misses by name.

The raw BLS projection alone scored slightly higher (ρ = 0.41), because AI risk had nothing to predict in a decade before language models. That's the honest claim: the AI exposure term is a bet on the future.

## The bug I'm proudest of finding

I caught my own methodology page being wrong. It said Fit was O\*NET skill-vector similarity, but when I read my data file, Fit was really a keyword match.

So I rebuilt Fit properly: a 68-dimension O\*NET vector per occupation (35 skills and 33 knowledge areas), cosine similarity, z-scored against the labor market. The reconciliation is committed in the repository, verdict by verdict.

## Stack

<dl class="facts">
  <dt>App</dt><dd>Next.js 16, React 19</dd>
  <dt>Language</dt><dd>TypeScript, Tailwind 4</dd>
  <dt>Hosting</dt><dd>AWS Amplify, Route 53</dd>
  <dt>Testing</dt><dd>35 automated tests, CI through GitHub</dd>
  <dt>Process</dt><dd>Spec-first with Claude Code and BMAD, PRD and architecture first</dd>
  <dt>Language model</dt><dd>Claude Haiku, for explanations only</dd>
  <dt>Data</dt><dd>BLS and O*NET; the scores are an open CSV (CC BY 4.0)</dd>
</dl>
