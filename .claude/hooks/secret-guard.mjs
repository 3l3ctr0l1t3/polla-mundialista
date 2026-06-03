#!/usr/bin/env node
/**
 * secret-guard — PreToolUse hook.
 * The repo is PUBLIC, so a leaked key is permanent. This blocks two things:
 *   1. Writing a service-account / admin key file into the repo tree (Write/Edit).
 *   2. Committing any staged secret-like file (Bash `git commit`).
 * Exit 2 = block and feed the message back to Claude. Exit 0 = allow.
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// Files that must never be committed (repo is public). `.env.example` is allowed.
const SECRET_PATTERNS = [
  /service[-_]?account[^/]*\.json$/i,
  /-firebase-adminsdk-[^/]*\.json$/i,
  /(^|\/)\.env(\.[^/]*)?$/i,
  /\.pem$/i,
  /\.key$/i,
];
const ALLOW = [/\.env\.example$/i];
const isSecret = (p) => !ALLOW.some((r) => r.test(p)) && SECRET_PATTERNS.some((r) => r.test(p));

// Writing one of these specific admin-key files into the tree is always wrong.
const ADMIN_KEY_FILE = [/service[-_]?account[^/]*\.json$/i, /-firebase-adminsdk-[^/]*\.json$/i];

let data = {};
try {
  data = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0); // no/garbled input → don't interfere
}

const tool = data.tool_name || '';
const input = data.tool_input || {};
const block = (msg) => {
  console.error('[secret-guard] BLOCKED: ' + msg);
  process.exit(2);
};

if (tool === 'Write' || tool === 'Edit') {
  const fp = String(input.file_path || '').replace(/\\/g, '/');
  if (ADMIN_KEY_FILE.some((r) => r.test(fp))) {
    block(
      'refusing to write an admin/service-account key into the repo: ' +
        fp +
        '\nKeep it outside the repo (or gitignored) and store the real value in GitHub Secrets.'
    );
  }
}

if (tool === 'Bash') {
  const cmd = String(input.command || '');
  if (/git\s+commit/.test(cmd)) {
    let staged = '';
    try {
      staged = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    } catch {
      /* not a git repo yet, or nothing staged */
    }
    const bad = staged
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter(isSecret);
    if (bad.length) {
      block(
        'these staged files look like secrets and would be committed to a PUBLIC repo:\n  ' +
          bad.join('\n  ') +
          '\nUnstage them (git rm --cached <file>) and confirm .gitignore covers them.'
      );
    }
  }
}

process.exit(0);
