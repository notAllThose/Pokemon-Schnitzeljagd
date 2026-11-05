import { createServer } from 'http';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { dirname, extname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const databaseDirectory = join(projectDirectory, 'data');
const databasePath = join(databaseDirectory, 'entdeckertour.sqlite');
const distributionDirectory = resolve(projectDirectory, 'dist');
const apiOnly = process.argv.includes('--api-only');
const port = Number(process.env.PORT || (apiOnly ? 3001 : 5173));
let nextRequestId = 0;

const logTime = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
function logValue(value, maxLength = 5000) {
  let text;
  try { text = JSON.stringify(value, null, 2); }
  catch { text = String(value); }
  if (text.length > maxLength) return `${text.slice(0, maxLength)}\n… [gekürzt; ${text.length} Zeichen]`;
  return text;
}
function logApiDetail(trace, label, value) {
  console.log(`  \x1b[36m${label}\x1b[0m ${logValue(value)}`);
}
function logDatabase(trace, operation, sql, params = [], result = '') {
  const query = sql.replace(/\s+/g, ' ').trim();
  console.log(`  \x1b[35mDB #${trace?.id ?? 'init'} ${operation}\x1b[0m ${query}`);
  console.log(`    params: ${logValue(params, 3000)}`);
  if (result !== '') console.log(`    result: ${logValue(result, 3000)}`);
}

// sql.js speichert SQLite in einer normalen Datei, benötigt aber keine nativen
// C++-Buildtools. Für die kleine Feier-App reicht es, die Datei pro Änderung
// atomar neu zu schreiben.
const SQL = await initSqlJs({
  locateFile: () => join(projectDirectory, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
});
mkdirSync(databaseDirectory, { recursive: true });
console.log(`[DB] ${existsSync(databasePath) ? 'Öffne' : 'Erstelle'} SQLite-Datei: ${databasePath}`);
const database = existsSync(databasePath)
  ? new SQL.Database(new Uint8Array(readFileSync(databasePath)))
  : new SQL.Database();
const createTableSql = `CREATE TABLE IF NOT EXISTS trainer_profiles (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
 )`;
database.run(createTableSql);
logDatabase(null, 'INIT', createTableSql, [], 'Tabelle trainer_profiles bereit');

function saveDatabase(trace) {
  const temporaryPath = `${databasePath}.tmp`;
  const bytes = Buffer.from(database.export());
  writeFileSync(temporaryPath, bytes);
  renameSync(temporaryPath, databasePath);
  logDatabase(trace, 'DATEI GESCHRIEBEN', 'entdeckertour.sqlite', [], `${bytes.length} Bytes`);
}

function sendJson(response, statusCode, value, trace = null) {
  if (trace) trace.responseBody = value;
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

function listProfiles(trace) {
  const sql = 'SELECT id, data_json FROM trainer_profiles ORDER BY updated_at, id';
  const statement = database.prepare(sql);
  const profiles = [];
  while (statement.step()) {
    const row = statement.getAsObject();
    profiles.push({ id: row.id, data: JSON.parse(row.data_json) });
  }
  statement.free();
  logDatabase(trace, 'SELECT', sql, [], `${profiles.length} Trainerprofile gelesen`);
  return profiles;
}

function readRequestBody(request, trace) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) rejectBody(new Error('Request ist zu groß.'));
    });
    request.on('end', () => {
      try {
        trace.requestBody = JSON.parse(body || '{}');
        resolveBody(trace.requestBody);
      }
      catch {
        trace.requestBody = body;
        rejectBody(new Error('Ungültige JSON-Daten.'));
      }
    });
    request.on('error', rejectBody);
  });
}

async function handleApi(request, response, pathname, trace) {
  if (request.method === 'GET' && pathname === '/api/profiles') {
    return sendJson(response, 200, { profiles: listProfiles(trace) }, trace);
  }

  if (request.method === 'PUT' && pathname.startsWith('/api/profiles/')) {
    const id = decodeURIComponent(pathname.slice('/api/profiles/'.length));
    trace.pathParams = { id };
    const body = await readRequestBody(request, trace);
    const profile = body.profile;
    if (!id || !profile || profile.id !== id || typeof profile.trainer !== 'string') {
      return sendJson(response, 400, { error: 'Trainerprofil ist unvollständig.' }, trace);
    }
    const sql = `INSERT INTO trainer_profiles (id, data_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`;
    const params = [id, JSON.stringify(profile), new Date().toISOString()];
    database.run(sql, params);
    logDatabase(trace, 'UPSERT', sql, params, '1 Trainerprofil gespeichert');
    saveDatabase(trace);
    return sendJson(response, 200, { saved: true, id }, trace);
  }

  if (request.method === 'DELETE' && pathname === '/api/profiles') {
    const sql = 'DELETE FROM trainer_profiles';
    database.run(sql);
    logDatabase(trace, 'DELETE', sql, [], 'Alle Trainerprofile gelöscht');
    saveDatabase(trace);
    return sendJson(response, 200, { deleted: true }, trace);
  }

  return sendJson(response, 404, { error: 'API-Adresse nicht gefunden.' }, trace);
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.manifest': 'application/manifest+json', '.ogg': 'audio/ogg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

function serveStatic(response, pathname) {
  if (!existsSync(join(distributionDirectory, 'index.html'))) {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Die App wurde noch nicht gebaut. Bitte erst npm run build ausführen.');
    return;
  }
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const filePath = resolve(distributionDirectory, relativePath);
  if (filePath !== distributionDirectory && !filePath.startsWith(distributionDirectory + sep)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': ['index.html', 'sw.js'].includes(relativePath) ? 'no-cache' : 'public, max-age=3600',
  });
  response.end(readFileSync(filePath));
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, 'http://localhost');
  const pathname = requestUrl.pathname;
  if (pathname.startsWith('/api/')) {
    const trace = {
      id: ++nextRequestId,
      startedAt: Date.now(),
      pathname,
      queryParams: Object.fromEntries(requestUrl.searchParams.entries()),
      pathParams: {},
      requestBody: '(kein Request-Body)',
      responseBody: null,
    };
    request.apiTrace = trace;
    console.log(`\n\x1b[1;36m[API #${trace.id} ${logTime()}] ${request.method} ${request.url}\x1b[0m`);
    logApiDetail(trace, 'Query-Params:', trace.queryParams);
    response.on('finish', () => {
      const statusColor = response.statusCode < 400 ? '\x1b[32m' : '\x1b[31m';
      console.log(`${statusColor}[API #${trace.id}] ${response.statusCode} · ${Date.now() - trace.startedAt} ms\x1b[0m`);
      logApiDetail(trace, 'Path-Params:', trace.pathParams);
      logApiDetail(trace, 'Request-Body:', trace.requestBody);
      logApiDetail(trace, 'Response-Body:', trace.responseBody);
    });
  }
  try {
    if (pathname.startsWith('/api/')) await handleApi(request, response, pathname, request.apiTrace);
    else if (!apiOnly && request.method === 'GET') serveStatic(response, pathname);
    else sendJson(response, 404, { error: 'Adresse nicht gefunden.' });
  } catch (error) {
    const status = error.message === 'Request ist zu groß.' ? 413 : 400;
    sendJson(response, status, { error: error.message || 'Serverfehler.' }, request.apiTrace ?? null);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Pokémon-Entdeckertour läuft auf http://localhost:${port}/`);
  console.log('API-Protokoll: Anfragen und Statuscodes erscheinen in diesem Fenster.');
  if (!apiOnly) console.log(`Gemeinsame Datenbank: ${databasePath}`);
});
