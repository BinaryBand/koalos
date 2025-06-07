import path from 'path';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { assert } from '../tools/misc.js';

let SQLite: Database<sqlite3.Database, sqlite3.Statement> | undefined = undefined;

const dbPath: string = path.join(__dirname, 'database.db');

async function createTableIfNotExists(): Promise<void> {
  const db: Database<sqlite3.Database, sqlite3.Statement> = getDatabase();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS key_value_store (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      expiration INTEGER NULL
    )
  `);
}

export async function initDatabase(): Promise<void> {
  if (SQLite === undefined) {
    SQLite = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    await createTableIfNotExists();
  }
}

export function getDatabase(): Database<sqlite3.Database, sqlite3.Statement> {
  assert(SQLite !== undefined, 'SQLite node not initialized');
  return SQLite;
}

export async function getFromCache(key: string): Promise<string | null> {
  const db: Database<sqlite3.Database, sqlite3.Statement> = getDatabase();
  const row = await db.get('SELECT value, expiration FROM key_value_store WHERE key = ?', [key]);

  if (row) {
    const currentTime: number = Date.now();
    if (row.expiration !== null && currentTime > row.expiration) {
      await db.run('DELETE FROM key_value_store WHERE key = ?', [key]);
      return null;
    }

    return row.value;
  }

  return null;
}

export async function setInCache(key: string, value: string, expiration?: number): Promise<void> {
  const db: Database<sqlite3.Database, sqlite3.Statement> = getDatabase();
  const expirationDate: Date | null = expiration ? new Date(Date.now() + expiration) : null;
  const expirationTimestamp: number | null = expirationDate ? expirationDate.getTime() : null;
  await db.run('INSERT OR REPLACE INTO key_value_store (key, value, expiration) VALUES (?, ?, ?)', [
    key,
    value,
    expirationTimestamp,
  ]);
}
