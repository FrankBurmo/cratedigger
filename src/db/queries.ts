import type Database from 'better-sqlite3';
import { getDb } from './schema.js';
import type { TrackRecord, TrackSummary, SearchFilters, IssueFilters } from '../types.js';

// ── Upsert ──────────────────────────────────────────────

export function upsertTrack(track: Omit<TrackRecord, 'indexed_at'>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tracks (
      path, mtime, size,
      title, artist, album, albumartist, year,
      tracknumber, totaltracks, discnumber, totaldiscs,
      genre, comment, composer,
      mb_trackid, mb_albumid, mb_artistid, mb_albumartistid,
      duration, bitrate, format, has_cover, issues
    ) VALUES (
      @path, @mtime, @size,
      @title, @artist, @album, @albumartist, @year,
      @tracknumber, @totaltracks, @discnumber, @totaldiscs,
      @genre, @comment, @composer,
      @mb_trackid, @mb_albumid, @mb_artistid, @mb_albumartistid,
      @duration, @bitrate, @format, @has_cover, @issues
    )
    ON CONFLICT(path) DO UPDATE SET
      mtime = excluded.mtime,
      size = excluded.size,
      title = excluded.title,
      artist = excluded.artist,
      album = excluded.album,
      albumartist = excluded.albumartist,
      year = excluded.year,
      tracknumber = excluded.tracknumber,
      totaltracks = excluded.totaltracks,
      discnumber = excluded.discnumber,
      totaldiscs = excluded.totaldiscs,
      genre = excluded.genre,
      comment = excluded.comment,
      composer = excluded.composer,
      mb_trackid = excluded.mb_trackid,
      mb_albumid = excluded.mb_albumid,
      mb_artistid = excluded.mb_artistid,
      mb_albumartistid = excluded.mb_albumartistid,
      duration = excluded.duration,
      bitrate = excluded.bitrate,
      format = excluded.format,
      has_cover = excluded.has_cover,
      issues = excluded.issues,
      indexed_at = datetime('now')
  `);
  stmt.run(track);
}

export function upsertTracksBatch(tracks: Omit<TrackRecord, 'indexed_at'>[]): void {
  const db = getDb();
  const transaction = db.transaction((items: Omit<TrackRecord, 'indexed_at'>[]) => {
    for (const track of items) {
      upsertTrack(track);
    }
  });
  transaction(tracks);
}

// ── Read ────────────────────────────────────────────────

export function getTrack(filePath: string): TrackRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM tracks WHERE path = ?').get(filePath) as TrackRecord | undefined;
}

export function getMtime(filePath: string): number | undefined {
  const db = getDb();
  const row = db.prepare('SELECT mtime FROM tracks WHERE path = ?').get(filePath) as
    | { mtime: number }
    | undefined;
  return row?.mtime;
}

export function getAllPaths(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT path FROM tracks').all() as { path: string }[];
  return rows.map((r) => r.path);
}

// ── Search ──────────────────────────────────────────────

export function searchTracks(filters: SearchFilters): TrackSummary[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.query) {
    conditions.push(
      `(title LIKE @query OR artist LIKE @query OR album LIKE @query)`
    );
    params.query = `%${filters.query}%`;
  }
  if (filters.artist) {
    conditions.push('artist LIKE @artist');
    params.artist = `%${filters.artist}%`;
  }
  if (filters.album) {
    conditions.push('album LIKE @album');
    params.album = `%${filters.album}%`;
  }
  if (filters.albumartist) {
    conditions.push('albumartist LIKE @albumartist');
    params.albumartist = `%${filters.albumartist}%`;
  }
  if (filters.year) {
    conditions.push('year = @year');
    params.year = filters.year;
  }
  if (filters.format) {
    conditions.push('format = @format');
    params.format = filters.format;
  }
  if (filters.has_cover !== undefined) {
    conditions.push('has_cover = @has_cover');
    params.has_cover = filters.has_cover ? 1 : 0;
  }
  if (filters.has_mb_trackid !== undefined) {
    if (filters.has_mb_trackid) {
      conditions.push('mb_trackid IS NOT NULL');
    } else {
      conditions.push('mb_trackid IS NULL');
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 50;

  const rows = db
    .prepare(
      `SELECT path, title, artist, album, year, issues
       FROM tracks ${where}
       ORDER BY artist, album, tracknumber
       LIMIT @limit`
    )
    .all({ ...params, limit }) as { path: string; title: string | null; artist: string | null; album: string | null; year: string | null; issues: string }[];

  return rows.map((r) => ({
    ...r,
    issues: JSON.parse(r.issues) as string[],
  }));
}

// ── Issues ──────────────────────────────────────────────

export function findIssues(filters: IssueFilters): TrackSummary[] {
  const db = getDb();
  const conditions: string[] = ["issues != '[]'"];
  const params: Record<string, unknown> = {};

  if (filters.issue_type) {
    conditions.push("issues LIKE @issue_type");
    params.issue_type = `%"${filters.issue_type}"%`;
  }
  if (filters.artist) {
    conditions.push('artist LIKE @artist');
    params.artist = `%${filters.artist}%`;
  }
  if (filters.album) {
    conditions.push('album LIKE @album');
    params.album = `%${filters.album}%`;
  }
  if (filters.format) {
    conditions.push('format = @format');
    params.format = filters.format;
  }

  const limit = filters.limit ?? 100;
  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = db
    .prepare(
      `SELECT path, title, artist, album, year, issues
       FROM tracks ${where}
       ORDER BY artist, album, tracknumber
       LIMIT @limit`
    )
    .all({ ...params, limit }) as { path: string; title: string | null; artist: string | null; album: string | null; year: string | null; issues: string }[];

  return rows.map((r) => ({
    ...r,
    issues: JSON.parse(r.issues) as string[],
  }));
}

// ── Album-level issues ──────────────────────────────────

interface AlbumInconsistency {
  album: string;
  albumartist: string | null;
}

export function getAlbumsWithInconsistentYear(): AlbumInconsistency[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT album, albumartist
       FROM tracks
       WHERE album IS NOT NULL
       GROUP BY album, albumartist
       HAVING COUNT(DISTINCT year) > 1`
    )
    .all() as AlbumInconsistency[];
}

export function getAlbumsWithInconsistentAlbumartist(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT album
       FROM tracks
       WHERE album IS NOT NULL AND albumartist IS NOT NULL
       GROUP BY album
       HAVING COUNT(DISTINCT albumartist) > 1`
    )
    .all() as { album: string }[];
  return rows.map((r) => r.album);
}

export function getTrackPathsByAlbum(album: string, albumartist?: string | null): string[] {
  const db = getDb();
  if (albumartist !== undefined && albumartist !== null) {
    const rows = db
      .prepare('SELECT path FROM tracks WHERE album = ? AND albumartist = ?')
      .all(album, albumartist) as { path: string }[];
    return rows.map((r) => r.path);
  }
  const rows = db
    .prepare('SELECT path FROM tracks WHERE album = ?')
    .all(album) as { path: string }[];
  return rows.map((r) => r.path);
}

// ── Update issues ───────────────────────────────────────

export function updateIssues(filePath: string, issues: string[]): void {
  const db = getDb();
  db.prepare('UPDATE tracks SET issues = ? WHERE path = ?').run(
    JSON.stringify(issues),
    filePath
  );
}

export function getIssues(filePath: string): string[] {
  const db = getDb();
  const row = db
    .prepare('SELECT issues FROM tracks WHERE path = ?')
    .get(filePath) as { issues: string } | undefined;
  if (!row) return [];
  return JSON.parse(row.issues) as string[];
}

// ── Cleanup ─────────────────────────────────────────────

export function removeMissingTracks(existingPaths: Set<string>): number {
  const db = getDb();
  const allPaths = getAllPaths();
  const toDelete = allPaths.filter((p) => !existingPaths.has(p));

  if (toDelete.length === 0) return 0;

  const transaction = db.transaction((paths: string[]) => {
    const stmt = db.prepare('DELETE FROM tracks WHERE path = ?');
    for (const p of paths) {
      stmt.run(p);
    }
  });
  transaction(toDelete);
  return toDelete.length;
}
