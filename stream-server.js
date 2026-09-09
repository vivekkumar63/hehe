/**
 * World Chaos Racing — Stream Server
 *
 * Serves the game + accepts canvas stream via WebSocket → FFmpeg → YouTube Live
 *
 * Usage:
 *   node stream-server.js YOUR_YOUTUBE_STREAM_KEY
 *
 * Then in OBS... actually no OBS needed!
 * Just open:  http://localhost:9877/?stream=1
 * Click "GO LIVE" and the stream starts immediately.
 *
 * Requires FFmpeg to be installed and on PATH.
 */

import http       from 'http';
import fs         from 'fs';
import path       from 'path';
import cp         from 'child_process';
import { WebSocketServer } from 'ws';
import { fileURLToPath }   from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const STREAM_KEY = process.argv[2] || '';
const PORT       = parseInt(process.argv[3] || '9877', 10);
const DIST       = path.join(__dirname, 'dist');

if (!STREAM_KEY) {
  console.error('\n  Usage: node stream-server.js YOUR_YOUTUBE_STREAM_KEY [PORT]\n');
  console.error('  PORT defaults to 9877. Run multiple instances with different ports.\n');
  process.exit(1);
}

const RTMP = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`;

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

// ── TTS (Windows SAPI) ───────────────────────────────────────────────────────
let ttsBusy = false;
function speak(text) {
  if (ttsBusy) return;
  ttsBusy = true;
  const safe = text.replace(/'/g, ' ');
  const cmd  = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; $s.Speak('${safe}')`;
  cp.spawn('powershell', ['-NoProfile', '-Command', cmd], { windowsHide: true, stdio: 'ignore' })
    .on('close', () => { ttsBusy = false; });
}

// ── FFmpeg process ───────────────────────────────────────────────────────────
let ffmpeg = null;

function startFFmpeg() {
  if (ffmpeg) return;
  console.log('\n  [STREAM] Starting FFmpeg → YouTube...\n');
  ffmpeg = cp.spawn('ffmpeg', [
    '-loglevel', 'warning',
    '-re',
    '-i', 'pipe:0',              // WebM from browser
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', '4000k',
    '-maxrate', '4000k',
    '-bufsize', '8000k',
    '-pix_fmt', 'yuv420p',
    '-g', '60',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    RTMP,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  ffmpeg.on('error', e => console.error('[FFmpeg error]', e.message));
  ffmpeg.on('close', code => {
    console.log('[FFmpeg] exited', code);
    ffmpeg = null;
  });
}

function stopFFmpeg() {
  if (!ffmpeg) return;
  ffmpeg.stdin.end();
  ffmpeg = null;
}

// ── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {

  if (req.url.startsWith('/speak')) {
    const text = new URLSearchParams(req.url.slice(req.url.indexOf('?') + 1)).get('t') || '';
    if (text) { process.stdout.write('[TTS] ' + text + '\n'); speak(text); }
    res.writeHead(200); res.end('ok');
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
});

// ── WebSocket — receives canvas stream from browser ──────────────────────────
const wss = new WebSocketServer({ server, path: '/ws-stream' });

wss.on('connection', ws => {
  console.log('[STREAM] Browser connected — starting stream');
  startFFmpeg();

  ws.on('message', chunk => {
    if (ffmpeg?.stdin?.writable) ffmpeg.stdin.write(chunk);
  });

  ws.on('close', () => {
    console.log('[STREAM] Browser disconnected — stopping stream');
    stopFFmpeg();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │   World Chaos Racing  —  Stream Server       │');
  console.log('  ├──────────────────────────────────────────────┤');
  console.log('  │  Open Chrome and go to:                      │');
  console.log(`  │    http://localhost:${PORT}/?stream=1            │`);
  console.log('  │                                              │');
  console.log(`  │  Key: ...${STREAM_KEY.slice(-6).padEnd(38)}│`);
  console.log('  │                                              │');
  console.log('  │  Click  GO LIVE  when ready.                 │');
  console.log('  │  Stream goes straight to YouTube.            │');
  console.log('  └──────────────────────────────────────────────┘');
  console.log('');
});
