#!/usr/bin/env node
/**
 * Print the Firebase project id for THIS repo, read from .firebaserc.
 *
 * The Firebase CLI otherwise resolves its target from a machine-wide
 * directory->project map (~/.config/configstore/firebase-tools.json), where a
 * PARENT directory entry wins over this repo's .firebaserc. On this machine
 * /Users/rockeypandit/work maps to a different project, so a bare
 * `firebase deploy` from here would silently target the wrong one.
 *
 * Every script passes --project "$(node scripts/firebase-project.mjs)" so the
 * target always comes from the repo, never from the ambient map.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const rcPath = join(repoRoot, '.firebaserc');

let rc;
try {
  rc = JSON.parse(readFileSync(rcPath, 'utf8'));
} catch (err) {
  console.error(`firebase-project: cannot read ${rcPath}: ${err.message}`);
  process.exit(1);
}

const projectId = rc?.projects?.default;
if (typeof projectId !== 'string' || !projectId.trim()) {
  console.error('firebase-project: .firebaserc has no projects.default');
  process.exit(1);
}

process.stdout.write(projectId.trim());
