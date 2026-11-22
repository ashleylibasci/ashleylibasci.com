#!/usr/bin/env node
// @ts-check
// Turns redirects.json into the custom-rules JSON Amplify accepts.
// --dry-run prints it (paste into Amplify > Rewrites and redirects > Manage redirects > JSON editor);
// otherwise it runs `aws amplify update-app --app-id <id> --custom-rules <json>`.
// Rules are normalized to {source, status, target, condition}: status as a string, condition null when absent.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readRedirects } from '../lib/urls.mjs';

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    'app-id': { type: 'string' },
    root: { type: 'string', default: process.cwd() },
  },
});

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`sync-redirects: ${message}`);
  process.exit(1);
}

/** @type {unknown} */
let raw;
try {
  raw = readRedirects(resolve(values.root));
} catch (err) {
  const code = /** @type {{ code?: string }} */ (err).code;
  fail(code === 'ENOENT' ? 'redirects.json is missing' : 'redirects.json is not valid JSON');
}
if (!Array.isArray(raw)) fail('redirects.json must be a JSON array of rules');

const rules = /** @type {unknown[]} */ (raw).map((rule, i) => {
  const r = /** @type {Record<string, unknown>} */ (rule && typeof rule === 'object' && !Array.isArray(rule) ? rule : {});
  const { source, target, status, condition } = r;
  const bad = [];
  if (typeof source !== 'string' || !source) bad.push('source');
  if (typeof target !== 'string' || !target) bad.push('target');
  if ((typeof status !== 'string' && typeof status !== 'number') || status === '') bad.push('status');
  if (bad.length) fail(`rule ${i + 1} has a missing or invalid ${bad.join(', ')}`);
  return { source, status: String(status), target, condition: condition ?? null };
});
const json = JSON.stringify(rules, null, 2) + '\n';

if (values['dry-run']) {
  process.stdout.write(json);
} else {
  const appId = values['app-id'] || process.env.AMPLIFY_APP_ID;
  if (!appId) fail('no app id: pass --app-id <id> or set AMPLIFY_APP_ID, or use --dry-run to print the rules');
  const r = spawnSync('aws', ['amplify', 'update-app', '--app-id', appId, '--custom-rules', json], { stdio: 'inherit' });
  if (r.error) {
    const code = /** @type {{ code?: string }} */ (r.error).code;
    if (code === 'ENOENT') fail('the AWS CLI was not found; paste the --dry-run output into the Amplify console instead');
    fail(r.error.message);
  }
  process.exitCode = r.status ?? 1;
}
