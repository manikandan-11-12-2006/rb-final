const http = require('http');
const fs = require('fs');
const path = require('path');

function createStaticServer(rootFolder, port, label) {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const server = http.createServer((req, res) => {
    // Parse URL
    let safeUrl = req.url.split('?')[0];
    if (safeUrl === '/') safeUrl = '/index.html';
    const filePath = path.join(rootFolder, safeUrl);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 Not Found: ${req.url}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.listen(port, () => {
    console.log(`[${label}] Running at: http://localhost:${port}/`);
  });

  return server;
}

createStaticServer(path.join(__dirname, 'feedback-interface'), 8000, 'Standalone Feedback Interface');
createStaticServer(path.join(__dirname, 'escalations-dashboard'), 8001, 'Tambaram Escalations Dashboard');
