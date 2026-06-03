#!/usr/bin/env node
/**
 * tasks-reminder — Stop hook.
 * Low-noise SDD nudge: only fires when there are uncommitted changes under
 * specs/ src/ or scripts/, reminding to keep tasks.md + backlog.md current.
 * Remove this hook from settings.json if you find it noisy.
 */
import { execSync } from 'node:child_process';

let status = '';
try {
  status = execSync('git status --porcelain', { encoding: 'utf8' });
} catch {
  process.exit(0); // not a git repo yet
}

const touched = status
  .split(/\r?\n/)
  .some((l) => /\s(specs|src|scripts)\//.test(l) || /^\s*[?AM].\s*(specs|src|scripts)\//.test(l));

if (!touched) process.exit(0);

console.log(
  JSON.stringify({
    systemMessage:
      'SDD reminder: you have uncommitted changes under specs/ or src/. If you implemented or verified a ticket, check off its tasks.md and update specs/backlog.md status.',
  })
);
process.exit(0);
