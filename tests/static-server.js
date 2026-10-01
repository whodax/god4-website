const fs = require('fs');
const http = require('http');
const path = require('path');
const generator = require('../tools/generate-translation-manifest.js');

const root = path.resolve(__dirname, '..');
const translationPaths = new Set(generator.translations.map(entry => entry.path));
const types = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8', '.png':'image/png',
  '.svg':'image/svg+xml', '.woff':'font/woff', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8'
};

http.createServer(function(request, response){
  var pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch(error){ response.writeHead(400).end(); return; }
  if(pathname === '/offline') pathname = '/offline.html';
  var file = path.resolve(root, '.' + pathname);
  if(file !== root && !file.startsWith(root + path.sep)){
    response.writeHead(403).end(); return;
  }
  try {
    if(fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    var body = fs.readFileSync(file);
    if(translationPaths.has(pathname)) body = generator.canonicalDeployBytes(body);
    response.writeHead(200, {
      'content-type':types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control':'no-store'
    });
    response.end(body);
  } catch(error){
    response.writeHead(404, {'content-type':'text/plain; charset=utf-8'}).end('Not found');
  }
}).listen(4173, '127.0.0.1');
