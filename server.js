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

// sql.js speichert SQLite in einer normalen Datei, benötigt aber keine nativen
// C++-Buildtools. Für die kleine Feier-App reicht es, die Datei pro Änderung
// atomar neu zu schreiben.
const SQL = await initSqlJs({
  locateFile: () => join(projectDirectory, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
});
mkdirSync(databaseDirectory, { recursive: true });
const database = existsSync(databasePath)
  ? new SQL.Database(new Uint8Array(readFileSync(databasePath)))
  : new SQL.Database();
database.run(`CREATE TABLE IF NOT EXISTS trainer_profiles (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

function saveDatabase() {
  const temporaryPath = `${databasePath}.tmp`;
  writeFileSync(temporaryPath, Buffer.from(database.export()));
  renameSync(temporaryPath, databasePath);
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

function listProfiles() {
  const statement = database.prepare('SELECT id, data_json FROM trainer_profiles ORDER BY updated_at, id');
  const profiles = [];
  while (statement.step()) {
    const row = statement.getAsObject();
    profiles.push({ id: row.id, data: JSON.parse(row.data_json) });
  }
  statement.free();
  return profiles;
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) rejectBody(new Error('Request ist zu groß.'));
    });
    request.on('end', () => {
      try { resolveBody(JSON.parse(body || '{}')); }
      catch { rejectBody(new Error('Ungültige JSON-Daten.')); }
    });
    request.on('error', rejectBody);
  });
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/profiles') {
    return sendJson(response, 200, { profiles: listProfiles() });
  }

  if (request.method === 'PUT' && pathname.startsWith('/api/profiles/')) {
    const id = decodeURIComponent(pathname.slice('/api/profiles/'.length));
    const body = await readRequestBody(request);
    const profile = body.profile;
    if (!id || !profile || profile.id !== id || typeof profile.trainer !== 'string') {
      return sendJson(response, 400, { error: 'Trainerprofil ist unvollständig.' });
    }
    database.run(
      `INSERT INTO trainer_profiles (id, data_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
      [id, JSON.stringify(profile), new Date().toISOString()],
    );
    saveDatabase();
    return sendJson(response, 200, { saved: true });
  }

  if (request.method === 'DELETE' && pathname === '/api/profiles') {
    database.run('DELETE FROM trainer_profiles');
    saveDatabase();
    return sendJson(response, 200, { deleted: true });
  }

  return sendJson(response, 404, { error: 'API-Adresse nicht gefunden.' });
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.manifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
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
  const pathname = new URL(request.url, 'http://localhost').pathname;
  try {
    if (pathname.startsWith('/api/')) await handleApi(request, response, pathname);
    else if (!apiOnly && request.method === 'GET') serveStatic(response, pathname);
    else sendJson(response, 404, { error: 'Adresse nicht gefunden.' });
  } catch (error) {
    const status = error.message === 'Request ist zu groß.' ? 413 : 400;
    sendJson(response, status, { error: error.message || 'Serverfehler.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Pokémon-Entdeckertour läuft auf http://localhost:${port}/`);
  if (!apiOnly) console.log(`Gemeinsame Datenbank: ${databasePath}`);
});
