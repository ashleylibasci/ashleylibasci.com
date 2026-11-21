---
title: Health Dashboard
printName: Health Dashboard
timelineName: Health Dashboard
status: building
href: /health-dashboard
summary: A sleep and recovery app that plans around my exams, with one recovery score each morning and a smart alarm on the Watch. It's getting ready for TestFlight.
stack:
  - Swift
order: 1
print:
  meta: '{status} · {stack}'
  label: 'Health Dashboard, {status}, iPhone and Apple Watch'
work:
  tag: '{status} · {stack} · iPhone and Apple Watch'
  linkLabel: Read the case study
  visualLabel: Health Dashboard case study
---

A sleep and recovery app for iPhone and Apple Watch that plans around my exams, written in Swift.

<dl>
  <dt>Status</dt><dd>Getting ready for TestFlight</dd>
  <dt>Code</dt><dd>Private, because the app was built on my own health data. I'm happy to walk through it in an interview.</dd>
</dl>

## The problem

No app fit my schedule. My weeks move around exams, and nothing I tried planned sleep or training around them. The closest one covered about half of what I wanted for around $100 a year, so I started building my own.

## What I'm building

<dl class="feat">
  <dt>Recovery score</dt><dd>One score each morning, based on sleep and heart-rate variability.</dd>
  <dt>Smart alarm</dt><dd>On iPhone and Apple Watch, with two modes: Easier wake-up or Most sleep.</dd>
  <dt>Exam-aware planning</dt><dd>On exam nights it works out bedtime backward from the exam's wake-up time, and the fitness plan arranges the week around exams.</dd>
  <dt>Fitness tab</dt><dd>Routines, plus a strength-set logger on the Watch.</dd>
  <dt>Watch app</dt><dd>Looks the same on every size from 40&nbsp;mm to 49&nbsp;mm.</dd>
</dl>

[[figure:nights]] **Figure 1. Sample data.** The two inputs to the recovery score over 28 nights: sleep (bars, hours) and heart-rate variability (line, ms). Made up for illustration, not my readings.

## Key decisions

### Keep the data on the device

Health data is personal, so it stays on the phone and watch. "Delete all data" really deletes it, rather than hiding it.

### Plan backward from the exam

Most sleep apps start from when you go to bed. On an exam night the fixed point is the morning, so the app starts from the exam's wake-up time and works back to a bedtime.

[[figure:plan-backward]] **Figure 2.** Example values, not my schedule. The exam fixes the wake-up time; bedtime is what the app solves for, with 15 minutes to fall asleep. You can try a simplified version on my [home page](/).

### Make the Watch alarm first-class

The smart alarm runs on the Watch as well as the phone, so the Watch app had to hold up on its own. It looks the same on every Watch size from 40 to 49&nbsp;mm.

## Where it is now

I'm getting it ready for TestFlight, Apple's beta testing. That has meant writing App Store privacy manifests and a privacy policy, and setting the app up so it says clearly that it's still being tested. On November 1 it got a new icon: a sunburst with a heartbeat line.

## Where it started

Before the native app there was an in-browser dashboard. It parses a 1.4&nbsp;GB Apple Health export in about 8 seconds on the device, without uploading anything. The Swift app grew out of wanting those views on my phone and wrist.

## Details

<dl class="facts">
  <dt>Platforms</dt><dd>iPhone and Apple Watch, plus the original web dashboard</dd>
  <dt>Language</dt><dd>Swift</dd>
  <dt>Status</dt><dd>Preparing for TestFlight</dd>
  <dt>Privacy</dt><dd>Data stays on the device; "Delete all data" really deletes it</dd>
  <dt>Web dashboard</dt><dd>Parses a 1.4 GB Apple Health export in about 8 seconds</dd>
  <dt>Repository</dt><dd>Private</dd>
</dl>
