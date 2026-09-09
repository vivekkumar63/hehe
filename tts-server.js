import http from 'http';
import fs   from 'fs';
import path from 'path';
import cp   from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9876;
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

let busy = false;
function speak(text) {
  if (busy) return;
  busy = true;
  const safe = text.replace(/'/g, ' ');
  const cmd  = [
    'Add-Type -AssemblyName System.Speech;',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
    '$s.Rate = 1;',
    `$s.Speak('${safe}');`,
  ].join(' ');
  cp.spawn('powershell', ['-NoProfile', '-Command', cmd], { windowsHide: true, stdio: 'ignore' })
    .on('close', () => { busy = false; });
}

http.createServer((req, res) => {

  if (req.url.startsWith('/speak')) {
    const text = new URLSearchParams(req.url.slice(req.url.indexOf('?') + 1)).get('t') || '';
    if (text) { process.stdout.write('[TTS] ' + text + '\n'); speak(text); }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  const urlPath  = req.url.split('?')[0];
  const filePath = path.resolve(DIST, '.' + urlPath);
  if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end(); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(DIST, 'index.html'), (_e, d) => {
        if (_e) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });

}).listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────┐');
  console.log('  │   World Chaos Racing  —  TTS Server      │');
  console.log('  ├──────────────────────────────────────────┤');
  console.log('  │  Point OBS Browser Source to:            │');
  console.log(`  │    http://localhost:${PORT}/               │`);
  console.log('  │                                          │');
  console.log('  │  OBS Desktop Audio must be ON.           │');
  console.log('  │  Keep this window open while streaming.  │');
  console.log('  └──────────────────────────────────────────┘');
  console.log('');
});
