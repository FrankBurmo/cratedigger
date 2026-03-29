import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initDb } from './db/schema.js';
import { registerTools } from './server.js';
import { config } from './config.js';
import { scanLibrary } from './scanner/scan.js';

const server = new McpServer({
  name: 'cratedigger',
  version: '1.0.0',
});

initDb(config.dbPath);
registerTools(server);

if (config.scanOnStartup) {
  scanLibrary(config.musicLibraryPath, false).catch((err) => {
    console.error('[startup] Background scan failed:', err);
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
