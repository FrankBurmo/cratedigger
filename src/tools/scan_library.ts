import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { scanLibrary } from '../scanner/scan.js';
import { config } from '../config.js';

export function registerScanLibrary(server: McpServer): void {
  server.tool(
    'scan_library',
    'Scans the music library and updates the SQLite cache. Supports incremental scanning via mtime.',
    {
      force: z.boolean().optional().describe('true = rescan all files, ignore mtime cache'),
    },
    async ({ force }) => {
      const result = await scanLibrary(config.musicLibraryPath, force ?? false);
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
