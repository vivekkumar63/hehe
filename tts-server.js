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

// ── Priority queue ────────────────────────────────────────────────────────────
// We send one line at a time and wait for the estimated duration before
// sending the next, so we can always insert priority items at the front.
const MAX_NORMAL = 2; // max regular messages waiting
const queue      = []; // [{ text, priority }]
let   speaking   = false;

function _next() {
  if (speaking || queue.length === 0) return;
  const { text } = queue.shift();
  speaking = true;
  process.stdout.write('[TTS] ' + text + '\n');
  ps.stdin.write(text + '\n');
  const ms = Math.max(1500, text.split(/\s+/).length * 370);
  setTimeout(() => { speaking = false; _next(); }, ms);
}

function speak(text, priority = false) {
  const safe = text.replace(/[\r\n]/g, ' ').replace(/'/g, ' ').trim();
  if (!safe) return;

  if (priority) {
    // Jump to front — plays right after the current utterance finishes
    queue.unshift({ text: safe, priority: true });
    // Clear any normal messages behind it so old commentary doesn't follow
    for (let i = queue.length - 1; i > 0; i--) {
      if (!queue[i].priority) queue.splice(i, 1);
    }
  } else {
    // Drop if too many normal messages are already waiting
    const normalCount = queue.filter(q => !q.priority).length;
    if (normalCount >= MAX_NORMAL) return;
    queue.push({ text: safe, priority: false });
  }

  _next();
}

// ── HTTP server ───────────────────────────────────────────────────────────────
http.createServer((req, res) => {

  if (req.url.startsWith('/speak')) {
    const params   = new URLSearchParams(req.url.slice(req.url.indexOf('?') + 1));
    const text     = params.get('t') || '';
    const priority = params.has('p');
    if (text) speak(text, priority);
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
