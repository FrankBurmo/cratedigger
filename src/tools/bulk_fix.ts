import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { writeTags } from '../tagger/write.js';

export function registerBulkFix(server: McpServer): void {
  server.tool(
    'bulk_fix',
    'Applies the same tag changes to many files in one call. Supports dry run. Never aborts the entire batch on a single failure.',
    {
      paths: z.array(z.string()).describe('List of absolute file paths'),
      changes: z.record(z.string()).describe('Tags to set identically on all files'),
      dry_run: z.boolean().optional().describe('true = preview changes without writing'),
    },
    async ({ paths, changes, dry_run }) => {
      const isDryRun = dry_run ?? false;
      const results: { path: string; success: boolean; error?: string }[] = [];
      let succeeded = 0;
      let failed = 0;

      for (const filePath of paths) {
        if (isDryRun) {
          results.push({ path: filePath, success: true });
          succeeded++;
          continue;
        }

        const result = await writeTags(filePath, changes);
        results.push({
          path: filePath,
          success: result.success,
          error: result.error,
        });
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                dry_run: isDryRun,
                total: paths.length,
                succeeded,
                failed,
                results,
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
