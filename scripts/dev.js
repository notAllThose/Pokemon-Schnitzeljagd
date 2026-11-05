import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;
const children = [
  spawn(node, [join(projectDirectory, 'server.js'), '--api-only'], {
    cwd: projectDirectory, env: { ...process.env, PORT: '3001' }, stdio: 'inherit',
  }),
  spawn(node, [join(projectDirectory, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0'], {
    cwd: projectDirectory, stdio: 'inherit',
  }),
];

function stopServers() {
  for (const child of children) if (!child.killed) child.kill();
}

process.on('SIGINT', () => { stopServers(); process.exit(0); });
process.on('SIGTERM', () => { stopServers(); process.exit(0); });
for (const child of children) child.on('exit', code => {
  if (code && code !== 0) process.exitCode = code;
  stopServers();
});
