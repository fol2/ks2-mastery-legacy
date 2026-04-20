import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

function rootDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

class SqliteD1Statement {
  constructor(statement) {
    this.statement = statement;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first(columnName = undefined) {
    const row = this.statement.get(...this.params);
    if (!row) return null;
    if (typeof columnName === 'string' && columnName) return row[columnName] ?? null;
    return { ...row };
  }

  async run() {
    const meta = this.statement.run(...this.params);
    return {
      success: true,
      meta: {
        changes: meta.changes,
        last_row_id: Number(meta.lastInsertRowid || 0),
      },
    };
  }

  async all() {
    const rows = this.statement.all(...this.params).map((row) => ({ ...row }));
    return { results: rows };
  }
}

export class SqliteD1Database {
  constructor(filename = ':memory:') {
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  prepare(sql) {
    return new SqliteD1Statement(this.db.prepare(sql));
  }

  async exec(sql) {
    this.db.exec(sql);
  }

  async batch(statements) {
    const savepoint = `sqlite_d1_batch_${Math.random().toString(36).slice(2, 10)}`;
    this.db.exec(`SAVEPOINT ${savepoint};`);
    try {
      const results = [];
      for (const statement of statements) {
        if (!statement) continue;
        results.push(await statement.run());
      }
      this.db.exec(`RELEASE SAVEPOINT ${savepoint};`);
      return results;
    } catch (error) {
      this.db.exec(`ROLLBACK TO SAVEPOINT ${savepoint};`);
      this.db.exec(`RELEASE SAVEPOINT ${savepoint};`);
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

export function migrationSql() {
  const migrationsDir = path.join(rootDir(), 'worker', 'migrations');
  return fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8'));
}

export function createMigratedSqliteD1Database() {
  const db = new SqliteD1Database();
  for (const sql of migrationSql()) {
    db.db.exec(sql);
  }
  return db;
}
