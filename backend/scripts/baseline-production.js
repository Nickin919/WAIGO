#!/usr/bin/env node
/**
 * One-time baseline for production when you see P3005 (database schema not empty).
 * Runs the three migration SQL files in order, then marks them as applied.
 * Run from backend dir: node scripts/baseline-production.js
 * Or with Railway: railway run --service WAIGO npm run baseline
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const migrations = [
  { name: '20260226000000_add_part_grid_and_catalog_source_fields', file: 'prisma/migrations/20260226000000_add_part_grid_and_catalog_source_fields/migration.sql' },
  { name: '20260226100000_add_failure_reports', file: 'prisma/migrations/20260226100000_add_failure_reports/migration.sql' },
  { name: '20260226200000_catalog_to_project_book_rename', file: 'prisma/migrations/20260226200000_catalog_to_project_book_rename/migration.sql' },
];

function run(cmd, opts = {}) {
  console.log('>', cmd);
  return execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}

console.log('Applying migration SQL files...');
for (const m of migrations) {
  const file = path.join(root, m.file);
  try {
    run(`npx prisma db execute --file "${m.file}"`);
  } catch (e) {
    console.error(`Failed to execute ${m.file}. If objects already exist, you may need to run "prisma migrate resolve --applied" for applied migrations only.`);
    process.exit(1);
  }
}

console.log('Marking migrations as applied...');
for (const m of migrations) {
  run(`npx prisma migrate resolve --applied ${m.name}`);
}

console.log('Baseline complete. Next deploy will run "prisma migrate deploy" with no pending migrations.');
