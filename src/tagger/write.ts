import { File as TagFile } from 'node-taglib-sharp';
import type { WriteResult } from '../types.js';
import { extractTags, detectFileIssues } from '../scanner/extract.js';
import { upsertTrack } from '../db/queries.js';
import fs from 'node:fs';

const TAG_FIELD_MAP: Record<string, (file: TagFile, value: string | null) => void> = {
  title: (f, v) => { f.tag.title = v ?? ''; },
  artist: (f, v) => { f.tag.performers = v ? [v] : []; },
  album: (f, v) => { f.tag.album = v ?? ''; },
  albumartist: (f, v) => { f.tag.albumArtists = v ? [v] : []; },
  year: (f, v) => { f.tag.year = v ? parseInt(v, 10) : 0; },
  tracknumber: (f, v) => { f.tag.track = v ? parseInt(v, 10) : 0; },
  totaltracks: (f, v) => { f.tag.trackCount = v ? parseInt(v, 10) : 0; },
  discnumber: (f, v) => { f.tag.disc = v ? parseInt(v, 10) : 0; },
  genre: (f, v) => { f.tag.genres = v ? [v] : []; },
  comment: (f, v) => { f.tag.comment = v ?? ''; },
  composer: (f, v) => { f.tag.composers = v ? [v] : []; },
  mb_trackid: (f, v) => { f.tag.musicBrainzTrackId = v ?? ''; },
  mb_albumid: (f, v) => { f.tag.musicBrainzReleaseId = v ?? ''; },
  mb_artistid: (f, v) => { f.tag.musicBrainzArtistId = v ?? ''; },
};

export async function writeTags(
  filePath: string,
  changes: Record<string, string | null>
): Promise<WriteResult> {
  try {
    const tagFile = TagFile.createFromPath(filePath);
    try {
      for (const [field, value] of Object.entries(changes)) {
        const setter = TAG_FIELD_MAP[field];
        if (!setter) {
          return { success: false, error: `Unknown field: ${field}` };
        }
        setter(tagFile, value);
      }
      tagFile.save();
    } finally {
      tagFile.dispose();
    }

    // Re-read tags and update database
    const fileStat = fs.statSync(filePath);
    const track = await extractTags(filePath, fileStat.mtimeMs, fileStat.size);
    upsertTrack(track);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
