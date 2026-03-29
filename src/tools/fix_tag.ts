import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { writeTags } from '../tagger/write.js';
import { getTrack } from '../db/queries.js';

export function registerFixTag(server: McpServer): void {
  server.tool(
    'fix_tag',
    'Sets one or more tags on a single file. Also updates the SQLite database.',
    {
      path: z.string().describe('Absolute file path'),
      changes: z.record(z.string()).describe('Map of tag fields to new values, e.g. { "year": "1997", "albumartist": "Daft Punk" }'),
    },
    async ({ path: filePath, changes }) => {
      const result = await writeTags(filePath, changes);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                path: filePath,
                applied: {},
                new_issues: [],
                error: result.error,
              }),
            },
          ],
          isError: true,
        };
      }

      const track = getTrack(filePath);
      const newIssues = track ? JSON.parse(track.issues) as string[] : [];

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                path: filePath,
                applied: changes,
                new_issues: newIssues,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
