# Implementeringsbeskrivelse: music-mcp-server

## Formål

En selvstendig MCP-server (Node.js) som eksponerer et musikkbibliotek til AI-assistenter
som GitHub Copilot. Serveren skanner musikkfiler, lagrer metadata i en lokal SQLite-database,
og tilbyr verktøy for å oppdage og fikse avvik i ID3/Vorbis-tagger via naturlig språk.

---

## Teknologistack

| Rolle                  | Pakke                          | Begrunnelse                                               |
|------------------------|--------------------------------|-----------------------------------------------------------|
| MCP-server             | `@modelcontextprotocol/sdk`    | Offisiell SDK, stdio-transport                            |
| Tag-lesing             | `music-metadata`               | Leser ID3v2, Vorbis, MP4 m.fl. – bred formatstøtte       |
| Tag-skriving           | `node-taglib-sharp`            | TagLib-wrapper med read/write for alle relevante formater |
| Database               | `better-sqlite3`               | Synkron SQLite, enkel å bruke fra Node                    |
| MusicBrainz-oppslag    | `musicbrainz-api`              | Offisiell REST-klient                                     |
| Filsystem-traversering | `fast-glob`                    | Rask rekursiv filsøk                                      |
| Konfigurasjon          | `zod` + `.env`-fil             | Validering av konfig                                      |

---

## Prosjektstruktur

```
music-mcp-server/
├── src/
│   ├── index.ts          # Inngangspunkt – starter MCP-server
│   ├── server.ts         # MCP-serveroppsett og tool-registrering
│   ├── db/
│   │   ├── schema.ts     # DDL og migreringer
│   │   └── queries.ts    # Alle SQL-spørringer (ingen inline SQL andre steder)
│   ├── scanner/
│   │   ├── scan.ts       # Rekursiv filskanning med mtime-sjekk
│   │   └── extract.ts    # Henter tags fra fil via music-metadata
│   ├── tagger/
│   │   └── write.ts      # Skriver tags via node-taglib-sharp
│   ├── musicbrainz/
│   │   └── lookup.ts     # Oppslag mot MusicBrainz REST API
│   ├── tools/            # Én fil per MCP-tool
│   │   ├── scan_library.ts
│   │   ├── find_issues.ts
│   │   ├── get_track.ts
│   │   ├── search_tracks.ts
│   │   ├── fix_tag.ts
│   │   ├── bulk_fix.ts
│   │   └── lookup_musicbrainz.ts
│   └── config.ts         # Zod-skjema for miljøvariabler
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Databaseskjema

```sql
-- src/db/schema.ts (kjøres ved oppstart hvis ikke eksisterer)

CREATE TABLE IF NOT EXISTS tracks (
    path            TEXT PRIMARY KEY,
    mtime           REAL NOT NULL,
    size            INTEGER,

    -- Kjernetagger
    title           TEXT,
    artist          TEXT,
    album           TEXT,
    albumartist     TEXT,
    year            TEXT,
    tracknumber     TEXT,
    totaltracks     TEXT,
    discnumber      TEXT,
    totaldiscs      TEXT,
    genre           TEXT,
    comment         TEXT,
    composer        TEXT,

    -- MusicBrainz-IDer
    mb_trackid      TEXT,
    mb_albumid      TEXT,
    mb_artistid     TEXT,
    mb_albumartistid TEXT,

    -- Tekniske felter
    duration        REAL,
    bitrate         INTEGER,
    format          TEXT,       -- 'mp3', 'flac', 'aac', 'm4a', etc.
    has_cover       INTEGER DEFAULT 0,

    -- Avvik oppdaget ved skanning
    issues          TEXT,       -- JSON-array: ["missing_year", "no_cover", ...]

    indexed_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_albumartist ON tracks(albumartist);
CREATE INDEX IF NOT EXISTS idx_format ON tracks(format);
CREATE INDEX IF NOT EXISTS idx_issues ON tracks(issues) WHERE issues != '[]';
```

### Mulige avviksverdier i `issues`-kolonnen

```
missing_title
missing_artist
missing_album
missing_albumartist
missing_year
missing_tracknumber
missing_genre
no_cover
inconsistent_albumartist   (ulike albumartist innenfor samme album)
inconsistent_year          (ulike år innenfor samme album)
missing_mb_trackid
```

---

## Scanner

### `scanner/scan.ts` – logikk

1. Ta imot `libraryPath` fra config.
2. Bruk `fast-glob` til å finne alle filer med extensions: `['mp3', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'wav']`.
3. For hver fil:
   - Hent `mtime` og `size` via `fs.stat`.
   - Sjekk om posten allerede finnes i `tracks`-tabellen med samme `mtime`.
   - Hvis uendret: hopp over.
   - Hvis ny eller endret: kall `extract.ts` og skriv/oppdater raden.
4. Slett rader i databasen der filen ikke lenger eksisterer på disk.
5. Kjør `detectAlbumLevelIssues()` etter skanning (se under).
6. Returner statistikk: `{ scanned, added, updated, removed, unchanged, durationMs }`.

### `scanner/extract.ts` – tag-ekstraksjon

```typescript
import * as mm from 'music-metadata';

// Returner et flatt objekt klart for INSERT/UPDATE i databasen.
// Alle felter som ikke finnes settes til null – aldri undefined.
async function extractTags(filePath: string): Promise<TrackRecord>

// issues-feltet beregnes her for feltene som kan vurderes per fil.
// Album-nivå-sjekker (inconsistent_albumartist etc.) gjøres i ett
// pass etter at alle filer er skannet.
function detectFileIssues(tags: Partial<TrackRecord>): string[]
```

---

## Tag-skriving

### `tagger/write.ts`

```typescript
import TagLib from 'node-taglib-sharp';

// Skriv én eller flere tagger til én fil.
// Returnerer { success: boolean, error?: string }.
// Etter vellykket skriving: oppdater raden i SQLite og kjør detectFileIssues på nytt.
async function writeTags(
    filePath: string,
    changes: Record<string, string | null>
): Promise<WriteResult>
```

Støttede feltnavn (same as database columns): `title`, `artist`, `album`, `albumartist`,
`year`, `tracknumber`, `totaltracks`, `discnumber`, `genre`, `comment`, `composer`,
`mb_trackid`, `mb_albumid`, `mb_artistid`.

---

## MCP-verktøy

Alle tools registreres i `server.ts` via `server.tool(name, schema, handler)`.
Hver tool bor i sin egen fil under `src/tools/`.

---

### `scan_library`

**Beskrivelse:** Skanner musikkbiblioteket og oppdaterer SQLite-cachen. Bør kjøres
ved oppstart og etter endringer i biblioteket. Støtter inkrementell skanning via mtime.

**Input:**
```typescript
{
  force?: boolean   // true = skann alle filer på nytt, ignorer mtime-cache
}
```

**Output:**
```typescript
{
  scanned: number,
  added: number,
  updated: number,
  removed: number,
  unchanged: number,
  durationMs: number
}
```

---

### `find_issues`

**Beskrivelse:** Returnerer filer med manglende eller inkonsistente tagger.
Primærverktøyet for å oppdage avvik i biblioteket.

**Input:**
```typescript
{
  issue_type?: string,    // filtrer på én spesifikk avvikstype, eller utelat for alle
  artist?: string,        // begrens til artist
  album?: string,         // begrens til album
  format?: string,        // 'mp3', 'flac', etc.
  limit?: number          // default 100
}
```

**Output:** Array av `TrackSummary`-objekter med `path`, `title`, `artist`, `album`,
`year`, `issues`.

---

### `get_track`

**Beskrivelse:** Henter alle metadata for én spesifikk fil.

**Input:**
```typescript
{
  path: string   // absolutt eller relativ filsti
}
```

**Output:** Komplett `TrackRecord` fra databasen.

---

### `search_tracks`

**Beskrivelse:** Fritekstsøk og filtrering mot databasen. Brukes for å finne
filer basert på naturlig-språk-aktige kriterier.

**Input:**
```typescript
{
  query?: string,         // søker i title, artist, album (LIKE %query%)
  artist?: string,
  album?: string,
  albumartist?: string,
  year?: string,
  format?: string,
  has_cover?: boolean,
  has_mb_trackid?: boolean,
  limit?: number          // default 50
}
```

**Output:** Array av `TrackSummary`.

---

### `fix_tag`

**Beskrivelse:** Setter én eller flere tagger på én fil. Oppdaterer også SQLite.

**Input:**
```typescript
{
  path: string,
  changes: Record<string, string>  // { "year": "1997", "albumartist": "Daft Punk" }
}
```

**Output:**
```typescript
{
  success: boolean,
  path: string,
  applied: Record<string, string>,
  new_issues: string[],
  error?: string
}
```

---

### `bulk_fix`

**Beskrivelse:** Anvender samme endring på mange filer i ett kall. Brukes typisk
etter `find_issues` eller `search_tracks`. Inkluderer tørrkjøring.

**Input:**
```typescript
{
  paths: string[],                  // liste med absolutte stier
  changes: Record<string, string>,  // tagger som settes likt på alle
  dry_run?: boolean                 // true = vis hva som ville blitt gjort, ikke skriv
}
```

**Output:**
```typescript
{
  dry_run: boolean,
  total: number,
  succeeded: number,
  failed: number,
  results: Array<{ path: string, success: boolean, error?: string }>
}
```

---

### `lookup_musicbrainz`

**Beskrivelse:** Søker MusicBrainz etter korrekte metadata for en låt eller et album.

**Input:**
```typescript
{
  title?: string,
  artist?: string,
  album?: string,
  mb_trackid?: string,   // direkte oppslag hvis kjent
  limit?: number         // default 5
}
```

**Output:**
```typescript
{
  recordings: Array<{
    mb_trackid: string,
    title: string,
    artist: string,
    album: string,
    year: string,
    mb_albumid: string,
    mb_artistid: string,
    score: number        // MusicBrainz-relevans 0–100
  }>
}
```

---

## Konfigurasjon (`.env`)

```env
# Absolutt sti til musikkbiblioteket
MUSIC_LIBRARY_PATH=/mnt/music

# Absolutt sti til SQLite-databasefil
DB_PATH=/home/user/.local/share/music-mcp/library.db

# MusicBrainz: User-Agent påkrevd av API-reglene
MB_APP_NAME=music-mcp-server
MB_APP_VERSION=1.0.0
MB_CONTACT_EMAIL=din@epost.no

# Valgfritt: skann automatisk ved oppstart
SCAN_ON_STARTUP=true

# Valgfritt: loggingsnivå
LOG_LEVEL=info
```

---

## Oppstart og stdio-transport

```typescript
// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initDb } from './db/schema.js';
import { registerTools } from './server.js';
import { config } from './config.js';

const server = new McpServer({
  name: 'music-mcp-server',
  version: '1.0.0'
});

await initDb(config.dbPath);
registerTools(server);

if (config.scanOnStartup) {
  // Kjør inkrementell skanning i bakgrunnen – blokker ikke oppstart
  scanLibrary({ force: false }).catch(console.error);
}

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## VSCode-konfigurasjon (GitHub Copilot)

```json
// .vscode/mcp.json  (eller globalt i settings.json)
{
  "servers": {
    "music-library": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolutt/sti/til/music-mcp-server/dist/index.js"],
      "env": {
        "MUSIC_LIBRARY_PATH": "/mnt/music",
        "DB_PATH": "/home/frank/.local/share/music-mcp/library.db"
      }
    }
  }
}
```

---

## Viktige implementeringsdetaljer

### Ytelse ved stor samling

- `better-sqlite3` er synkron og svært rask for lesing. 50 000 rader er trivielt.
- Under skanning: bruk `better-sqlite3` sin `transaction()`-wrapper for bulk-inserts
  (1000-vis av inserts per sekund vs. én om gangen).
- `music-metadata` kan lese tags uten å laste inn hele lydfilen (`{ duration: false }`
  er litt raskere for store filer).
- Første fullskanning av 50 000 filer over NFS: forvent 3–8 minutter avhengig av
  nettverkshastighet. Påfølgende inkrementelle skanninger: sekunder.

### Album-nivå-avvik

Etter filskanning, kjør en SQL-basert etterkjøring for å finne album-interne
inkonsistenser:

```sql
-- Eksempel: finn album med flere ulike år
SELECT album, albumartist, COUNT(DISTINCT year) as year_count
FROM tracks
WHERE album IS NOT NULL
GROUP BY album, albumartist
HAVING year_count > 1;
```

Oppdater `issues`-kolonnen for berørte filer med `inconsistent_year`
(append til eksisterende JSON-array).

### Rate limiting mot MusicBrainz

MusicBrainz tillater maks 1 request/sekund uten autentisering. Implementer
en enkel købasert throttler i `musicbrainz/lookup.ts`. `musicbrainz-api`-pakken
håndterer dette automatisk hvis konfigurert korrekt.

### Feilhåndtering i bulk_fix

Aldri avbryt hele batch ved én feil. Samle feil per fil og returner
dem i `results`-arrayen. Logg alle feil til stderr (ikke stdout, som
brukes av MCP stdio-transport).

---

## Eksempel på typisk arbeidsflyt i Copilot

```
Bruker:  "Finn alle album der ikke alle sporene har albumartist-tagg"
→ find_issues({ issue_type: "missing_albumartist" })

Bruker:  "Hva er riktig albumartist for disse filene?"
→ search_tracks({ album: "Discovery" }) + lookup_musicbrainz(...)

Bruker:  "Sett albumartist til 'Daft Punk' på alle disse filene"
→ bulk_fix({ paths: [...], changes: { albumartist: "Daft Punk" } })

Bruker:  "Skann biblioteket på nytt og vis meg en oppsummering av avvik"
→ scan_library({}) + find_issues({})
```
