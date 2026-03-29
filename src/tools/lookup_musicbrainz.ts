import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { lookupMusicBrainz } from '../musicbrainz/lookup.js';

export function registerLookupMusicbrainz(server: McpServer): void {
  server.tool(
    'lookup_musicbrainz',
    'Searches MusicBrainz for correct metadata for a track or album.',
    {
      title: z.string().optional().describe('Track title'),
      artist: z.string().optional().describe('Artist name'),
      album: z.string().optional().describe('Album name'),
      mb_trackid: z.string().optional().describe('MusicBrainz recording ID for direct lookup'),
      limit: z.number().optional().describe('Max results (default 5)'),
    },
    async ({ title, artist, album, mb_trackid, limit }) => {
      const result = await lookupMusicBrainz({
        title, artist, album, mb_trackid, limit,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
