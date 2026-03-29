import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { findIssues } from '../db/queries.js';

export function registerFindIssues(server: McpServer): void {
  server.tool(
    'find_issues',
    'Returns files with missing or inconsistent tags. Primary tool for discovering issues in the library.',
    {
      issue_type: z.string().optional().describe('Filter by specific issue type, e.g. "missing_year", "no_cover"'),
      artist: z.string().optional().describe('Filter by artist'),
      album: z.string().optional().describe('Filter by album'),
      format: z.string().optional().describe('Filter by format: mp3, flac, etc.'),
      limit: z.number().optional().describe('Max results (default 100)'),
    },
    async ({ issue_type, artist, album, format, limit }) => {
      const results = findIssues({ issue_type, artist, album, format, limit });
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
