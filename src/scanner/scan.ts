import fg from 'fast-glob';
import fs from 'node:fs';
import path from 'node:path';
import type { ScanResult } from '../types.js';
import { extractTags } from './extract.js';
import {
  getMtime,
  upsertTracksBatch,
  removeMissingTracks,
  getAlbumsWithInconsistentYear,
  getAlbumsWithInconsistentAlbumartist,
  getTrackPathsByAlbum,
  getIssues,
  updateIssues,
} from '../db/queries.js';

const AUDIO_EXTENSIONS = ['mp3', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'wav'];
const BATCH_SIZE = 500;

export async function scanLibrary(
  libraryPath: string,
  force = false
): Promise<ScanResult> {
  const start = performance.now();

  const patterns = AUDIO_EXTENSIONS.map((ext) => `**/*.${ext}`);
  const files = await fg(patterns, {
    cwd: libraryPath,
    absolute: true,
    followSymbolicLinks: true,
    caseSensitiveMatch: false,
  });

  const stats: ScanResult = {
    scanned: files.length,
    added: 0,
    updated: 0,
    removed: 0,
    unchanged: 0,
    durationMs: 0,
  };

  const existingPaths = new Set(files);
  let batch: Awaited<ReturnType<typeof extractTags>>[] = [];

  for (const filePath of files) {
    try {
      const fileStat = fs.statSync(filePath);
      const mtime = fileStat.mtimeMs;

      if (!force) {
        const cachedMtime = getMtime(filePath);
        if (cachedMtime !== undefined && cachedMtime === mtime) {
          stats.unchanged++;
          continue;
        }
        if (cachedMtime !== undefined) {
          stats.updated++;
        } else {
          stats.added++;
        }
      } else {
        // When forced, count everything as updated or added
        const cachedMtime = getMtime(filePath);
        if (cachedMtime !== undefined) {
          stats.updated++;
        } else {
          stats.added++;
        }
      }

      const track = await extractTags(filePath, mtime, fileStat.size);
      batch.push(track);

      if (batch.length >= BATCH_SIZE) {
        upsertTracksBatch(batch);
        batch = [];
      }
    } catch (err) {
      console.error(`[scanner] Failed to process ${filePath}:`, err);
    }
  }

  // Flush remaining batch
  if (batch.length > 0) {
    upsertTracksBatch(batch);
  }

  // Remove tracks for files that no longer exist
  stats.removed = removeMissingTracks(existingPaths);

  // Detect album-level issues
  detectAlbumLevelIssues();

  stats.durationMs = Math.round(performance.now() - start);
  return stats;
}

function detectAlbumLevelIssues(): void {
  // Inconsistent year within an album
  const yearInconsistencies = getAlbumsWithInconsistentYear();
  for (const { album, albumartist } of yearInconsistencies) {
    const paths = getTrackPathsByAlbum(album, albumartist);
    for (const p of paths) {
      addIssueIfMissing(p, 'inconsistent_year');
    }
  }

  // Inconsistent albumartist within same album name
  const albumartistInconsistencies = getAlbumsWithInconsistentAlbumartist();
  for (const album of albumartistInconsistencies) {
    const paths = getTrackPathsByAlbum(album);
    for (const p of paths) {
      addIssueIfMissing(p, 'inconsistent_albumartist');
    }
  }
}

function addIssueIfMissing(filePath: string, issue: string): void {
  const current = getIssues(filePath);
  if (!current.includes(issue)) {
    current.push(issue);
    updateIssues(filePath, current);
  }
}
