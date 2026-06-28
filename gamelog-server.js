const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = 1625;
const ALLOWED_LOG_FILES = new Set([
  '/home/cod4/mods/test/games_mp.log',
]);
const MAX_FILE_TIME_CHANGE_SECONDS = 30;
const MAX_PATH_PARAM_LENGTH = 1024;
const MAX_READ_BYTES_PER_REQUEST = 512 * 1024;

const ALLOWED_CLIENT_IPS = new Set([
  '127.0.0.1',
  '::1'
]);

const ALLOWED_LOG_DIRS = new Set(
  Array.from(ALLOWED_LOG_FILES).map(f => path.posix.dirname(f))
);

const logFileSizes = new Map();

function normalizeClientIp(ip) {
  if (!ip) {
    return '';
  }
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function isAllowedClient(req) {
  const ip = normalizeClientIp(req.socket && req.socket.remoteAddress);
  return ALLOWED_CLIENT_IPS.has(ip);
}

function forbiddenResponse(res) {
  return res.status(403).json(badResponse());
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function generateKey() {
  return crypto.randomBytes(6).toString('base64url').toUpperCase().slice(0, 8);
}

function clearOldLogs() {
  const now = nowSeconds();
  for (const [key, value] of logFileSizes.entries()) {
    if (now - value.read > MAX_FILE_TIME_CHANGE_SECONDS) {
      logFileSizes.delete(key);
    }
  }
}

function decodePath(encodedPath) {
  const normalized = encodedPath.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  const decoded = Buffer.from(padded, 'base64').toString('utf8');

  if (decoded.includes('\0')) {
    throw new Error('Path contains null byte');
  }

  return decoded;
}

function normalizeRequestedPath(logPath) {
  let normalized = logPath;
  if (process.platform !== 'win32') {
    normalized = normalized.replace(/^[A-Z]:/i, '').replace(/\\+/g, '/');
  }

  normalized = normalized.replace(/\/+/g, '/');

  return normalized;
}

function isAllowedLogPath(logPath) {
  const resolved = path.posix.resolve('/', logPath).replace(/\\/g, '/');

  if (!ALLOWED_LOG_FILES.has(resolved)) {
    return false;
  }

  const dir = path.posix.dirname(resolved);
  return ALLOWED_LOG_DIRS.has(dir);
}

function badResponse() {
  return {
    success: false,
    length: 0,
    data: null,
    next_key: null
  };
}

function readFileChunk(logPath, retrievalKey) {
  clearOldLogs();

  if (!isAllowedLogPath(logPath)) {
    return badResponse();
  }

  let stat;
  try {
    stat = fs.statSync(logPath);
  } catch {
    return badResponse();
  }

  const newFileSize = stat.size;
  const currentTime = nowSeconds();
  const existing = logFileSizes.get(retrievalKey);
  const isExistingValid = existing && (currentTime - existing.read <= MAX_FILE_TIME_CHANGE_SECONDS);
  const lastLogInfo = isExistingValid
    ? existing
    : { size: newFileSize, previousKey: null };

  const expiredKey = lastLogInfo.previousKey;
  const lastSize = lastLogInfo.size;
  const rawLengthToRead = Math.max(0, newFileSize - lastSize);
  const lengthToRead = Math.min(rawLengthToRead, MAX_READ_BYTES_PER_REQUEST);
  const readFrom = Math.max(lastSize, newFileSize - lengthToRead);
  const nextKey = generateKey();

  logFileSizes.set(nextKey, {
    size: newFileSize,
    read: currentTime,
    previousKey: retrievalKey
  });

  if (expiredKey && logFileSizes.has(expiredKey)) {
    logFileSizes.delete(expiredKey);
  }

  let content = '';
  if (lengthToRead > 0) {
    const fd = fs.openSync(logPath, 'r');
    try {
      const buffer = Buffer.alloc(lengthToRead);
      fs.readSync(fd, buffer, 0, lengthToRead, readFrom);
      content = buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  }

  return {
    success: true,
    length: content.length,
    data: content,
    next_key: nextKey
  };
}

app.get('/log/:encodedPath/:retrievalKey', (req, res) => {
  if (!isAllowedClient(req)) {
    return forbiddenResponse(res);
  }

  if (req.params.encodedPath.length > MAX_PATH_PARAM_LENGTH) {
    return forbiddenResponse(res);
  }

  const retrievalKey = req.params.retrievalKey;
  if (!/^(next|[A-Z0-9_-]{1,32})$/.test(retrievalKey)) {
    return forbiddenResponse(res);
  }

  try {
    const decoded = decodePath(req.params.encodedPath);
    const logPath = normalizeRequestedPath(decoded);
    const data = readFileChunk(logPath, retrievalKey);
    return res.json(data);
  } catch {
    return res.json(badResponse());
  }
});

app.get('/health', (req, res) => {
  if (!isAllowedClient(req)) {
    return res.status(403).json({ ok: false });
  }
  res.json({ ok: true, port: PORT, allowedLogFileCount: ALLOWED_LOG_FILES.size });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Game log server listening on 127.0.0.1:${PORT}`);
  console.log(`Allowed log files: ${Array.from(ALLOWED_LOG_FILES).join(', ')}`);
  console.log(`Allowed client IPs: ${Array.from(ALLOWED_CLIENT_IPS).join(', ')}`);
});
