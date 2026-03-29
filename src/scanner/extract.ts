import * as mm from 'music-metadata';
import path from 'node:path';
import type { TrackRecord } from '../types.js';

export async function extractTags(
  filePath: string,
  mtime: number,
  size: number
): Promise<Omit<TrackRecord, 'indexed_at'>> {
  const metadata = await mm.parseFile(filePath);
  const { common, format } = metadata;

  const ext = path.extname(filePath).toLowerCase().replace('.', '');

  const tags: Omit<TrackRecord, 'indexed_at'> = {
    path: filePath,
    mtime,
    size,
    title: common.title ?? null,
    artist: common.artist ?? null,
    album: common.album ?? null,
    albumartist: common.albumartist ?? null,
    year: common.year !== undefined ? String(common.year) : null,
    tracknumber: common.track?.no !== undefined && common.track.no !== null
      ? String(common.track.no)
      : null,
    totaltracks: common.track?.of !== undefined && common.track.of !== null
      ? String(common.track.of)
      : null,
    discnumber: common.disk?.no !== undefined && common.disk.no !== null
      ? String(common.disk.no)
      : null,
    totaldiscs: common.disk?.of !== undefined && common.disk.of !== null
      ? String(common.disk.of)
      : null,
    genre: common.genre?.[0] ?? null,
    comment: common.comment?.[0]?.text ?? null,
    composer: common.composer?.[0] ?? null,

    mb_trackid: common.musicbrainz_recordingid ?? null,
    mb_albumid: common.musicbrainz_albumid ?? null,
    mb_artistid: common.musicbrainz_artistid?.[0] ?? null,
    mb_albumartistid: common.musicbrainz_albumartistid?.[0] ?? null,

    duration: format.duration ?? null,
    bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
    format: ext,
    has_cover: common.picture && common.picture.length > 0 ? 1 : 0,

    issues: '[]', // Will be populated by detectFileIssues
  };

  tags.issues = JSON.stringify(detectFileIssues(tags));
  return tags;
}

export function detectFileIssues(
  tags: Partial<Omit<TrackRecord, 'indexed_at'>>
): string[] {
  const issues: string[] = [];

  if (!tags.title) issues.push('missing_title');
  if (!tags.artist) issues.push('missing_artist');
  if (!tags.album) issues.push('missing_album');
  if (!tags.albumartist) issues.push('missing_albumartist');
  if (!tags.year) issues.push('missing_year');
  if (!tags.tracknumber) issues.push('missing_tracknumber');
  if (!tags.genre) issues.push('missing_genre');
  if (!tags.has_cover || tags.has_cover === 0) issues.push('no_cover');
  if (!tags.mb_trackid) issues.push('missing_mb_trackid');

  return issues;
}
