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

// ── Persistent PowerShell TTS process ────────────────────────────────────────
// One process stays alive and reads text lines from stdin, speaking each in order.
// This eliminates the ~300ms spawn overhead on every utterance.
const psScript = [
  'Add-Type -AssemblyName System.Speech;',
  '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
  '$s.Rate = 2;',
  'while ($true) {',
  '  $line = [Console]::In.ReadLine();',
  '  if ($null -eq $line) { break }',
  '  if ($line.Length -gt 0) { $s.Speak($line) }',
  '}',
].join(' ');

const ps = cp.spawn('powershell', ['-NoProfile', '-Command', psScript], {
  windowsHide: true,
  stdio: ['pipe', 'ignore', 'ignore'],
});

ps.on('error', e => console.error('[TTS] PowerShell error:', e.message));
ps.on('close', code => { console.log('[TTS] PowerShell exited', code); process.exit(1); });

// Queue depth tracking — drop new messages if too many are already pending
// so old commentary doesn't play after the race has moved on.
const MAX_QUEUE = 3;
let queueDepth = 0;

function speak(text) {
  if (queueDepth >= MAX_QUEUE) return;
  const safe = text.replace(/[\r\n]/g, ' ').replace(/'/g, ' ').trim();
  if (!safe) return;

  queueDepth++;
  process.stdout.write('[TTS] ' + safe + '\n');
  ps.stdin.write(safe + '\n');

  // Estimate speech duration to release the queue slot
  const ms = Math.max(1500, safe.split(/\s+/).length * 370);
  setTimeout(() => { queueDepth = Math.max(0, queueDepth - 1); }, ms);
}

// ── HTTP server ───────────────────────────────────────────────────────────────
http.createServer((req, res) => {

  if (req.url.startsWith('/speak')) {
    const text = new URLSearchParams(req.url.slice(req.url.indexOf('?') + 1)).get('t') || '';
    if (text) speak(text);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  const urlPath  = req.url.split('?')[0];
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  const filePath = path.join(DIST, relative);

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
