# Game Log Server

Reads CoD4 game log files over HTTP for [IW4M-Admin](https://github.com/RaidMax/IW4M-Admin).

## Setup

```bash
npm install
node gamelog-server.js
```

Runs on `127.0.0.1:1625` (localhost only).

## Configuration

Edit the constants at the top of `gamelog-server.js`:

| Constant | Default | Description |
|---|---|---|
| `PORT` | `1625` | Server port |
| `ALLOWED_LOG_FILES` | *(see file)* | Set of absolute log file paths that can be read |
| `ALLOWED_CLIENT_IPS` | `127.0.0.1`, `::1` | IPs allowed to connect |
| `MAX_FILE_TIME_CHANGE_SECONDS` | `30` | Session key expiry in seconds |
| `MAX_READ_BYTES_PER_REQUEST` | `512 KB` | Max bytes read per request |

Only files explicitly listed in `ALLOWED_LOG_FILES` can be served. All other paths are rejected.

## Security

- Requests from IPs not in `ALLOWED_CLIENT_IPS` receive a `403 Forbidden`.
- All requested paths are canonicalized with `path.posix.resolve` before being checked against the allowlist, preventing path traversal attacks.
- Null bytes in decoded paths are rejected.
- The `/health` endpoint does not expose internal file paths.
- The server binds to `127.0.0.1` only. If running behind a reverse proxy, ensure only trusted proxy IPs are in `ALLOWED_CLIENT_IPS`.

## Endpoints

### `GET /log/:encodedPath/:retrievalKey`

Reads new bytes appended to a log file since the last request.

- `:encodedPath` — Base64url-encoded absolute path to the log file (must be in `ALLOWED_LOG_FILES`)
- `:retrievalKey` — Session key from a previous response, or `next` for the first request

**Response:**
```json
{
  "success": true,
  "length": 128,
  "data": "...",
  "next_key": "A1B2C3D4"
}
```

On error or unauthorized access:
```json
{
  "success": false,
  "length": 0,
  "data": null,
  "next_key": null
}
```

### `GET /health`

Returns server status. Restricted to `ALLOWED_CLIENT_IPS`.

```json
{ "ok": true, "port": 1625, "allowedLogFileCount": 1 }
```

## IW4MAdmin Setup

Add this to your IW4MAdmin config:

```json
"Servers": [
  {
    "IPAddress": "YOUR_SERVER_IP",
    "Port": 28960,
    "Password": "rconpassword",
    "Rules": [],
    "AutoMessages": [],
    "ManualLogPath": "file:////home/cod4/mods/test/games_mp.log",
    "RConParserVersion": "CoD4x Parser",
    "EventParserVersion": "CoD4x Parser",
    "ReservedSlotNumber": 0,
    "GameLogServerUrl": "http://127.0.0.1:1625/",
    "CustomHostname": null
  }
]
```

Replace `YOUR_SERVER_IP` with your actual game server IP and update `ManualLogPath` to match the log file path in `ALLOWED_LOG_FILES`.
