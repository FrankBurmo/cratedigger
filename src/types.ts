export interface TrackRecord {
  path: string;
  mtime: number;
  size: number | null;

  // Core tags
  title: string | null;
  artist: string | null;
  album: string | null;
  albumartist: string | null;
  year: string | null;
  tracknumber: string | null;
  totaltracks: string | null;
  discnumber: string | null;
  totaldiscs: string | null;
  genre: string | null;
  comment: string | null;
  composer: string | null;

  // MusicBrainz IDs
  mb_trackid: string | null;
  mb_albumid: string | null;
  mb_artistid: string | null;
  mb_albumartistid: string | null;

  // Technical fields
  duration: number | null;
  bitrate: number | null;
  format: string | null;
  has_cover: number;

  // Issues detected during scanning
  issues: string; // JSON array: '["missing_year", "no_cover", ...]'

  indexed_at: string;
}

export interface TrackSummary {
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  year: string | null;
  issues: string[];
}

export interface ScanResult {
  scanned: number;
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  durationMs: number;
}

export interface WriteResult {
  success: boolean;
  error?: string;
}

export interface SearchFilters {
  query?: string;
  artist?: string;
  album?: string;
  albumartist?: string;
  year?: string;
  format?: string;
  has_cover?: boolean;
  has_mb_trackid?: boolean;
  limit?: number;
}

export interface IssueFilters {
  issue_type?: string;
  artist?: string;
  album?: string;
  format?: string;
  limit?: number;
}

export type IssueType =
  | 'missing_title'
  | 'missing_artist'
  | 'missing_album'
  | 'missing_albumartist'
  | 'missing_year'
  | 'missing_tracknumber'
  | 'missing_genre'
  | 'no_cover'
  | 'inconsistent_albumartist'
  | 'inconsistent_year'
  | 'missing_mb_trackid';
