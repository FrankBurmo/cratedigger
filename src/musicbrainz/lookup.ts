import { MusicBrainzApi } from 'musicbrainz-api';
import { config } from '../config.js';

let client: MusicBrainzApi;

function getClient(): MusicBrainzApi {
  if (!client) {
    client = new MusicBrainzApi({
      appName: config.mbAppName,
      appVersion: config.mbAppVersion,
      appContactInfo: config.mbContactEmail,
    });
  }
  return client;
}

export interface MBRecording {
  mb_trackid: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  mb_albumid: string;
  mb_artistid: string;
  score: number;
}

export interface MBLookupResult {
  recordings: MBRecording[];
}

export interface MBLookupParams {
  title?: string;
  artist?: string;
  album?: string;
  mb_trackid?: string;
  limit?: number;
}

export async function lookupMusicBrainz(params: MBLookupParams): Promise<MBLookupResult> {
  const api = getClient();
  const limit = params.limit ?? 5;

  // Direct lookup by MBID
  if (params.mb_trackid) {
    try {
      const recording = await api.lookup('recording', params.mb_trackid, [
        'artists',
        'releases',
      ]);
      const release = recording.releases?.[0];
      return {
        recordings: [
          {
            mb_trackid: recording.id,
            title: recording.title,
            artist:
              recording['artist-credit']
                ?.map((c) => c.name)
                .join(', ') ?? '',
            album: release?.title ?? '',
            year: release?.date?.substring(0, 4) ?? '',
            mb_albumid: release?.id ?? '',
            mb_artistid: recording['artist-credit']?.[0]?.artist?.id ?? '',
            score: 100,
          },
        ],
      };
    } catch (err) {
      console.error('[musicbrainz] Direct lookup failed:', err);
      return { recordings: [] };
    }
  }

  // Build search query
  const queryParts: string[] = [];
  if (params.title) queryParts.push(`recording:"${params.title}"`);
  if (params.artist) queryParts.push(`artist:"${params.artist}"`);
  if (params.album) queryParts.push(`release:"${params.album}"`);

  if (queryParts.length === 0) {
    return { recordings: [] };
  }

  try {
    const result = await api.search('recording', {
      query: queryParts.join(' AND '),
      limit,
    });

    const recordings: MBRecording[] = (result.recordings ?? []).map(
      (rec) => {
        const release = rec.releases?.[0];
        return {
          mb_trackid: rec.id,
          title: rec.title,
          artist:
            rec['artist-credit']?.map((c) => c.name).join(', ') ?? '',
          album: release?.title ?? '',
          year: release?.date?.substring(0, 4) ?? '',
          mb_albumid: release?.id ?? '',
          mb_artistid: rec['artist-credit']?.[0]?.artist?.id ?? '',
          score: rec.score ?? 0,
        };
      }
    );

    return { recordings };
  } catch (err) {
    console.error('[musicbrainz] Search failed:', err);
    return { recordings: [] };
  }
}
