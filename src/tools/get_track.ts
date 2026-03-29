import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getTrack } from '../db/queries.js';

export function registerGetTrack(server: McpServer): void {
  server.tool(
    'get_track',
    'Gets all metadata for a specific file.',
    {
      path: z.string().describe('Absolute or relative file path'),
    },
    async ({ path: filePath }) => {
      const track = getTrack(filePath);
      if (!track) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Track not found: ${filePath}` }),
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { ...track, issues: JSON.parse(track.issues) },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
