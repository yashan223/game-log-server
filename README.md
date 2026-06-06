# Game Log Server

Reads CoD4 game log files over HTTP for [IW4M-Admin](https://github.com/RaidMax/IW4M-Admin).

## Setup

```bash
npm install
node gamelog-server.js
```

Runs on `127.0.0.1:1625`.

## Endpoints

- `GET /log/:encodedPath/:retrievalKey` — Read new log data
- `GET /health` — Health check

## Configuration

Edit the constants at the top of `gamelog-server.js`:

- `PORT` — Server port (default: `1625`)
- `ALLOWED_LOG_FILES` — Log files that can be read
- `ALLOWED_CLIENT_IPS` — IPs allowed to connect


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
    "ManualLogPath": "file:////home/deep/cod4/snd/mods/test/games_mp.log",
    "RConParserVersion": "CoD4x Parser",
    "EventParserVersion": "CoD4x Parser",
    "ReservedSlotNumber": 0,
    "GameLogServerUrl": "http://YOUR_SERVER_IP:1625/",
    "CustomHostname": null
  }
]
```

Replace `YOUR_SERVER_IP` with your actual server IP and update `ManualLogPath` to match the log file path in `ALLOWED_LOG_FILES`.
