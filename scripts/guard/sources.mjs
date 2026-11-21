// Which files the privacy guard reads.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.npm', '.git']);

function walk(dir, root, out, skip) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) walk(full, root, out, skip);
    } else if (entry.isFile()) {
      out.push(relative(root, full).split(sep).join('/'));
    }
  }
  return out;
}

/** Tracked and untracked-but-not-ignored files; a directory walk when there is no Git. */
export function sourceFiles(root) {
  if (existsSync(join(root, '.git'))) {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return out
      .split('\0')
      .filter(Boolean)
      .filter((f) => existsSync(join(root, f)) && statSync(join(root, f)).isFile());
  }
  return walk(root, root, [], SKIP_DIRS);
}

/** Built HTML and PDF files in dist/. */
export function distFiles(root) {
  const dist = join(root, 'dist');
  if (!existsSync(dist)) return [];
  return walk(dist, root, [], new Set()).filter((f) => /\.(html?|pdf)$/i.test(f));
}
