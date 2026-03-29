import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerScanLibrary } from './tools/scan_library.js';
import { registerFindIssues } from './tools/find_issues.js';
import { registerGetTrack } from './tools/get_track.js';
import { registerSearchTracks } from './tools/search_tracks.js';
import { registerFixTag } from './tools/fix_tag.js';
import { registerBulkFix } from './tools/bulk_fix.js';
import { registerLookupMusicbrainz } from './tools/lookup_musicbrainz.js';

export function registerTools(server: McpServer): void {
  registerScanLibrary(server);
  registerFindIssues(server);
  registerGetTrack(server);
  registerSearchTracks(server);
  registerFixTag(server);
  registerBulkFix(server);
  registerLookupMusicbrainz(server);
}
