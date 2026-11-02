const test = require('node:test');
const assert = require('node:assert');
const { planMigration } = require('../lib/migration-plan');

test('existing database without history is baselined, never rebuilt', () => {
  assert.deepStrictEqual(planMigration({ hasMigrationsTable: false, hasAppTables: true }), { baseline: true, deploy: true });
});

test('database with history only runs new migrations', () => {
  assert.deepStrictEqual(planMigration({ hasMigrationsTable: true, hasAppTables: true }), { baseline: false, deploy: true });
});

test('empty database runs every migration from scratch', () => {
  assert.deepStrictEqual(planMigration({ hasMigrationsTable: false, hasAppTables: false }), { baseline: false, deploy: true });
});
