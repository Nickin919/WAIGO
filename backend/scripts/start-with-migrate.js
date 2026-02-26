#!/usr/bin/env node
/**
 * Start command wrapper: run prisma migrate deploy, baseline on P3005, then start app.
 * Used as Railway start command so existing production DBs can self-baseline.
 */
const { execSync, spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', ...opts });
}

function runDetectP3005(cmd) {
  try {
    run(cmd, { stdio: 'pipe' });
    return false;
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '') + String(e.message || '');
    return out.includes('P3005') || out.includes('database schema is not empty');
  }
}

console.log('Running prisma migrate deploy...');
const needsBaseline = runDetectP3005('npx prisma migrate deploy');

if (needsBaseline) {
  console.log('P3005 detected: baselining existing database (one-time)...');
  try {
    run('node scripts/baseline-production.js', { stdio: 'inherit' });
  } catch (err) {
    console.error('Baseline failed. Run manually: npm run baseline');
    process.exit(1);
  }
  console.log('Retrying prisma migrate deploy...');
  run('npx prisma migrate deploy', { stdio: 'inherit' });
}

console.log('Starting application...');
const result = spawnSync('node', ['dist/server.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
