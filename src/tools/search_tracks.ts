import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchTracks } from '../db/queries.js';

export function registerSearchTracks(server: McpServer): void {
  server.tool(
    'search_tracks',
    'Free-text search and filtering against the database. Find files based on natural-language-like criteria.',
    {
      query: z.string().optional().describe('Searches in title, artist, album (LIKE %query%)'),
      artist: z.string().optional().describe('Filter by artist'),
      album: z.string().optional().describe('Filter by album'),
      albumartist: z.string().optional().describe('Filter by album artist'),
      year: z.string().optional().describe('Filter by year'),
      format: z.string().optional().describe('Filter by format: mp3, flac, etc.'),
      has_cover: z.boolean().optional().describe('Filter by cover art presence'),
      has_mb_trackid: z.boolean().optional().describe('Filter by MusicBrainz track ID presence'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async ({ query, artist, album, albumartist, year, format, has_cover, has_mb_trackid, limit }) => {
      const results = searchTracks({
        query, artist, album, albumartist, year, format, has_cover, has_mb_trackid, limit,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
  );
}
