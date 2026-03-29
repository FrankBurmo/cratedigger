# cratedigger

[![Build](https://github.com/FrankBurmo/cratedigger/actions/workflows/build.yml/badge.svg)](https://github.com/FrankBurmo/cratedigger/actions/workflows/build.yml)

MCP server for your music library — find and fix ID3/Vorbis tag issues using natural language via GitHub Copilot or any MCP-compatible AI assistant.

## Features

- **Scans** your music library (MP3, FLAC, M4A, AAC, OGG, Opus, WMA, WAV) and indexes metadata into a local SQLite database
- **Incremental scanning** — only re-reads files that have changed since the last scan
- **Detects tag issues** per file and per album (missing fields, no cover art, year/albumartist inconsistencies within albums)
- **Writes tags** via TagLib — updates the DB automatically after every write
- **MusicBrainz lookups** to find correct metadata for recordings and albums
- **Bulk fixes** — apply a tag change to hundreds of files in one Copilot prompt

## Prerequisites

- Node.js ≥ 20
- A C++ build toolchain for native addons (`better-sqlite3`, `node-taglib-sharp`)
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Linux: `build-essential python3`
  - Windows: [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools) or Visual Studio Build Tools

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/cratedigger
cd cratedigger
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```env
# Required
MUSIC_LIBRARY_PATH=/path/to/your/music
DB_PATH=/home/user/.local/share/cratedigger/library.db
MB_CONTACT_EMAIL=your@email.com

# Optional
MB_APP_NAME=cratedigger
MB_APP_VERSION=1.0.0
SCAN_ON_STARTUP=true
LOG_LEVEL=info
```

`MB_CONTACT_EMAIL` is required by the [MusicBrainz API policy](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting).

## Running

```bash
# Development (no build step needed, uses tsx)
npm run dev

# Production
npm run build
npm start
```

## VS Code / GitHub Copilot setup

Edit `.vscode/mcp.json` to point to your built server and set your paths:

```json
{
  "servers": {
    "cratedigger": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/cratedigger/dist/index.js"],
      "env": {
        "MUSIC_LIBRARY_PATH": "/path/to/your/music",
        "DB_PATH": "/home/user/.local/share/cratedigger/library.db",
        "MB_CONTACT_EMAIL": "your@email.com"
      }
    }
  }
}
```

Once connected, Copilot can call the tools directly. Example prompts:

> *"Scan my library and show me all tracks missing an albumartist tag"*
> *"Find all albums where not every track has the same year"*
> *"Look up the correct metadata for Discovery by Daft Punk on MusicBrainz"*
> *"Set albumartist to 'Daft Punk' on all tracks in the Discovery album"*

## MCP Tools

| Tool | Description |
|------|-------------|
| `scan_library` | Scan the library and update the cache. Accepts `force: true` to ignore mtime. |
| `find_issues` | List files with tag problems. Filter by `issue_type`, `artist`, `album`, `format`. |
| `get_track` | Get all metadata for a single file by path. |
| `search_tracks` | Search by title/artist/album, filter by year, format, cover presence, MusicBrainz ID. |
| `fix_tag` | Set one or more tags on a single file. |
| `bulk_fix` | Apply the same tag changes to many files at once. Supports `dry_run`. |
| `lookup_musicbrainz` | Search MusicBrainz for correct metadata. Returns up to 5 matches with relevance scores. |

### Detectable issue types

`missing_title` · `missing_artist` · `missing_album` · `missing_albumartist` · `missing_year` ·
`missing_tracknumber` · `missing_genre` · `no_cover` · `inconsistent_albumartist` ·
`inconsistent_year` · `missing_mb_trackid`

## Project structure

```
src/
├── index.ts              # Entrypoint — starts the MCP server
├── server.ts             # Tool registration
├── config.ts             # Zod-validated environment config
├── types.ts              # Shared TypeScript types
├── db/
│   ├── schema.ts         # SQLite DDL and initDb()
│   └── queries.ts        # All SQL operations (no inline SQL elsewhere)
├── scanner/
│   ├── extract.ts        # Tag reading (music-metadata) + per-file issue detection
│   └── scan.ts           # Library scan orchestration + album-level issue detection
├── tagger/
│   └── write.ts          # Tag writing (node-taglib-sharp) + DB sync
├── musicbrainz/
│   └── lookup.ts         # MusicBrainz REST API wrapper
└── tools/                # One file per MCP tool
    ├── scan_library.ts
    ├── find_issues.ts
    ├── get_track.ts
    ├── search_tracks.ts
    ├── fix_tag.ts
    ├── bulk_fix.ts
    └── lookup_musicbrainz.ts
```

## License

[Apache License 2.0](LICENSE)
