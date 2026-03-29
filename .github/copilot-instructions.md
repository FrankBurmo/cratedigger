# Copilot instructions for cratedigger

## Project overview

Cratedigger is a Node.js/TypeScript MCP server that scans a local music library, stores
metadata in SQLite, and exposes tools for AI assistants to discover and fix tag issues.

## Tech stack

- **Runtime:** Node.js ≥ 20, ESM (`"type": "module"` in package.json)
- **Language:** TypeScript 5, strict mode, `NodeNext` module resolution
- **MCP:** `@modelcontextprotocol/sdk` — tools registered via `server.tool(name, zodSchema, handler)`
- **Database:** `better-sqlite3` (synchronous SQLite)
- **Tag reading:** `music-metadata`
- **Tag writing:** `node-taglib-sharp`
- **Config:** Zod schema in `src/config.ts` validating environment variables
- **Paths:** all imports use `.js` extensions (required for NodeNext ESM)

## Coding conventions

### SQL
- **All SQL lives in `src/db/queries.ts`** — never write inline SQL in other files.
- Use named parameters (`@paramName`) rather than positional `?` for clarity.
- Wrap bulk writes in `db.transaction()` for performance.

### Logging
- **All logging goes to stderr** (`console.error`) — stdout is reserved for the MCP stdio transport.
- Never use `console.log` for diagnostic output.

### Error handling
- In `bulk_fix`: never abort the batch on a per-file error; collect errors per file and return them.
- Use `try/finally` in `writeTags` to always call `tagFile.dispose()`.

### MCP tools
- One tool per file under `src/tools/`.
- Each file exports a single `register*` function that receives an `McpServer` instance.
- Return `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }` for success.
- Return `isError: true` alongside the content for failures.

### Types
- Shared types live in `src/types.ts` — add new shared interfaces there, not inline.
- `TrackRecord.issues` is stored as a JSON string in SQLite; parse/stringify at the DB boundary in `queries.ts`.

### Config
- All environment variables are accessed through the validated `config` object from `src/config.ts`.
- Never read `process.env.*` outside of `src/config.ts`.

## Project structure

```
src/
├── index.ts              # Entrypoint
├── server.ts             # registerTools()
├── config.ts             # Zod env validation
├── types.ts              # Shared interfaces
├── db/
│   ├── schema.ts         # initDb(), DDL
│   └── queries.ts        # All SQL
├── scanner/
│   ├── extract.ts        # Tag reading + per-file issue detection
│   └── scan.ts           # Scan orchestration + album-level issues
├── tagger/
│   └── write.ts          # Tag writing + DB sync
├── musicbrainz/
│   └── lookup.ts         # MusicBrainz API
└── tools/                # One file per MCP tool
```

## Adding a new MCP tool

1. Create `src/tools/<tool_name>.ts` exporting `register<ToolName>(server: McpServer): void`.
2. Define the input schema with Zod inside the `server.tool()` call.
3. Import and call the new `register*` function inside `src/server.ts`.

## Adding a new issue type

1. Add the new value to the `IssueType` union in `src/types.ts`.
2. Add a detection check in `detectFileIssues()` in `src/scanner/extract.ts` (per-file issues)
   or in `detectAlbumLevelIssues()` in `src/scanner/scan.ts` (album-level issues).

## Build

```bash
npm run build   # tsc → dist/
npm run dev     # tsx src/index.ts (no build step)
npm start       # node dist/index.js
```
