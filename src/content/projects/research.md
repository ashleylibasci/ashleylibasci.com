---
title: Future of Math Research
printName: Illinois Mathematics Lab
timelineName: Undergraduate researcher
start: 2026-08-01
status: ongoing
href: /research
summary: A competitive, faculty-mentored project on math research in the AI age. We generate proofs with language models, verify them in Lean, and write up the results. Part of it is The Proof of History, a math-history site that is still in progress.
stack:
  - Lean 4
  - language models
  - generative AI
order: 3
print:
  meta: 'Research · {since}'
  label: 'Illinois Mathematics Lab research, {since}'
work:
  tag: '{range} · Illinois Mathematics Lab · MATH 492'
  linkLabel: About the research
---

I was selected for Future of Math Research, a competitive faculty-mentored project at the Illinois Mathematics Lab on math research in the AI age. We generate proofs with language models, verify them in Lean, and communicate the results with generative AI.

## The question

A proof assistant doesn't care who wrote a proof. If Lean accepts it with no goals left, it's correct, whether a person or a model produced it. That lets us take model output seriously without taking it on trust, and it raises real questions about how research gets done and shared.

<div class="code">
<div class="fn">SumOdd.lean</div>

<pre tabindex="0" role="region" aria-label="SumOdd.lean"><span class="k">open</span> Finset

<span class="c">-- 1 + 3 + 5 + ... + (2n - 1) = n²</span>
<span class="k">theorem</span> sum_odd (n : ℕ) :
    ∑ i ∈ range n, (2 * i + 1) = n ^ 2 := <span class="k">by</span>
  <span class="k">induction</span> n <span class="k">with</span>
  | zero => simp
  | succ k ih => rw [sum_range_succ, ih]; ring</pre>
</div>
<p class="cap">An illustrative example in Lean 4 with Mathlib, not one of our results.</p>

## My role

I'm one of the undergraduate researchers on a team with faculty mentor Jacob Beckey. It runs as MATH 492, about ten hours a week.

## The Proof of History

Part of the project is a math-history site about how mathematicians have shared and checked their work, with case files, a timeline and sources. It's a work in progress and goes public once the last round of reviewer corrections is in.

[[figure:opening]] Work in progress: the opening of The Proof of History.

## Project

<dl class="facts">
  <dt>Program</dt><dd>Illinois Mathematics Lab, UIUC</dd>
  <dt>Course</dt><dd>MATH 492, 3 credits</dd>
  <dt>Term</dt><dd>August 2026 to now</dd>
  <dt>Team</dt><dd>A faculty mentor and 3 to 5 undergraduates</dd>
  <dt>Tools</dt><dd>Lean 4, language models, generative AI</dd>
</dl>
