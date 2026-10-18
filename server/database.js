import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  function prepare(sql) {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      first() { return sqlite.prepare(sql).get(...args) || null; },
      all() { return { results: sqlite.prepare(sql).all(...args) }; },
      run() { return sqlite.prepare(sql).run(...args); },
    };
  }
  return { prepare,
    batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const results = statements.map(statement => statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); },
  };
}
