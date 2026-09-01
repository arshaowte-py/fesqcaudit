#!/usr/bin/env node
/**
 * Create or update an account.
 *
 * This is the ONLY way an account comes into existence — the sign-in flow only
 * ever reads the `users` collection, so requesting a code can never create one.
 *
 *   npm run seed:user -- someone@myfrido.com
 *   npm run seed:user -- someone@myfrido.com --can-delete
 *   npm run seed:user -- someone@myfrido.com --disable
 *   npm run seed:user -- --list
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const projectId = JSON.parse(readFileSync(join(repoRoot, '.firebaserc'), 'utf8'))?.projects?.default;
if (!projectId) {
  console.error('No projects.default in .firebaserc');
  process.exit(1);
}

const ALLOWED_DOMAIN = 'myfrido.com';
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

if (flags.has('--list')) {
  const snap = await db.collection('users').get();
  if (snap.empty) console.log('(no users)');
  snap.forEach((d) => {
    const u = d.data();
    console.log(
      `${d.id.padEnd(34)} canDelete=${u.canDelete === true}  disabled=${u.disabled === true}  lastLogin=${u.lastLoginAt || 'never'}`
    );
  });
  process.exit(0);
}

if (!email) {
  console.error('Usage: npm run seed:user -- <email@myfrido.com> [--can-delete] [--disable]');
  process.exit(1);
}
if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
  console.error(`Refusing: only @${ALLOWED_DOMAIN} addresses can sign in.`);
  process.exit(1);
}

const patch = { email, updatedAt: new Date().toISOString() };
if (flags.has('--can-delete')) patch.canDelete = true;
if (flags.has('--disable')) patch.disabled = true;
if (flags.has('--enable')) patch.disabled = false;

const ref = db.collection('users').doc(email);
const existed = (await ref.get()).exists;
if (!existed) patch.createdAt = patch.updatedAt;
await ref.set(patch, { merge: true });

const saved = (await ref.get()).data();
console.log(`${existed ? 'Updated' : 'Created'} ${email} in ${projectId}`);
console.log(`  canDelete=${saved.canDelete === true}  disabled=${saved.disabled === true}`);
process.exit(0);
