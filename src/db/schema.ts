import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      path            TEXT PRIMARY KEY,
      mtime           REAL NOT NULL,
      size            INTEGER,

      -- Core tags
      title           TEXT,
      artist          TEXT,
      album           TEXT,
      albumartist     TEXT,
      year            TEXT,
      tracknumber     TEXT,
      totaltracks     TEXT,
      discnumber      TEXT,
      totaldiscs      TEXT,
      genre           TEXT,
      comment         TEXT,
      composer        TEXT,

      -- MusicBrainz IDs
      mb_trackid      TEXT,
      mb_albumid      TEXT,
      mb_artistid     TEXT,
      mb_albumartistid TEXT,

      -- Technical fields
      duration        REAL,
      bitrate         INTEGER,
      format          TEXT,
      has_cover       INTEGER DEFAULT 0,

      -- Issues detected during scanning
      issues          TEXT DEFAULT '[]',

      indexed_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_album ON tracks(album);
    CREATE INDEX IF NOT EXISTS idx_albumartist ON tracks(albumartist);
    CREATE INDEX IF NOT EXISTS idx_format ON tracks(format);
    CREATE INDEX IF NOT EXISTS idx_issues ON tracks(issues) WHERE issues != '[]';
  `);

  return db;
}
