const fs = require('fs');
const http = require('http');
const path = require('path');
const generator = require('../tools/generate-translation-manifest.js');

const root = path.resolve(__dirname, '..');
const headerSource = fs.readFileSync(path.join(root, '_headers'), 'utf8');
const policy = /^\s+Content-Security-Policy:\s*(.+)$/m.exec(headerSource)?.[1];
const translationPaths = new Set(generator.translations.map(entry => entry.path));
if (!policy) throw new Error('Missing enforcing CSP header');

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

async function startCspServer() {
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end(); return; }
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(403).end(); return;
    }
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      const stat = fs.statSync(file);
      if (!stat.isFile()) throw new Error('Not a file');
      response.writeHead(200, {
        'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Security-Policy': policy,
        'X-Content-Type-Options': 'nosniff',
        'Permissions-Policy': 'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)'
      });
      if(translationPaths.has(pathname)) response.end(generator.canonicalDeployBytes(fs.readFileSync(file)));
      else {
        const stream = fs.createReadStream(file);
        response.once('close', () => stream.destroy());
        stream.once('error', error => response.destroy(error));
        stream.pipe(response);
      }
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  let closing;
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => closing || (closing = new Promise((resolve, reject) => {
      // Stop accepting first, then release every test-owned transport, including
      // browser preconnections which have not sent an HTTP request yet.
      server.close(error => error ? reject(error) : resolve());
      for (const socket of sockets) socket.destroy();
    }))
  };
}

module.exports = { startCspServer, policy };
