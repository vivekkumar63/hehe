/**
 * Browser-side canvas streamer.
 * Activated when URL contains ?stream=1.
 * Captures Phaser canvas + audio and sends WebM chunks to stream-server.js via WebSocket.
 */

export function initStreaming() {
  const params = new URLSearchParams(location.search);
  if (!params.has('stream')) return;

  // Port is taken from the page's own origin so multiple instances just work
  const port   = location.port || '9877';
  const WS_URL = `ws://localhost:${port}/ws-stream`;

  // Inject GO LIVE button overlay
  const btn = document.createElement('button');
  btn.id = 'go-live-btn';
  btn.textContent = 'GO LIVE';
  Object.assign(btn.style, {
    position:     'fixed',
    bottom:       '30px',
    left:         '50%',
    transform:    'translateX(-50%)',
    zIndex:       '99999',
    padding:      '14px 40px',
    fontSize:     '20px',
    fontWeight:   'bold',
    fontFamily:   'sans-serif',
    color:        '#fff',
    background:   '#e00',
    border:       'none',
    borderRadius: '8px',
    cursor:       'pointer',
    boxShadow:    '0 4px 16px rgba(0,0,0,0.5)',
  });
  document.body.appendChild(btn);

  btn.addEventListener('click', () => startStream(btn, WS_URL), { once: true });
}

function startStream(btn, WS_URL) {
  // Find Phaser's canvas
  const canvas = document.querySelector('canvas');
  if (!canvas) { alert('Canvas not found — is the game loaded?'); return; }

  btn.textContent  = 'Connecting…';
  btn.style.background = '#888';
  btn.disabled = true;

  const ws = new WebSocket(WS_URL);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    const videoStream  = canvas.captureStream(30);

    // AudioManager exposes a MediaStream tapped from the master gain node
    const audioStream  = window.__gameAudioStream;
    const audioTracks  = audioStream ? audioStream.getAudioTracks() : [];

    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioTracks,
    ]);

    const mimeType = _pickMime();
    const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 4_000_000 });

    recorder.ondataavailable = e => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };

    recorder.start(100); // 100 ms chunks

    btn.textContent  = '🔴 LIVE';
    btn.style.background = '#c00';
    btn.style.cursor = 'default';
    btn.title = 'Streaming to YouTube';

    ws.onclose = () => {
      recorder.stop();
      btn.textContent  = 'DISCONNECTED';
      btn.style.background = '#555';
    };
  };

  ws.onerror = () => {
    btn.textContent  = 'WS ERROR';
    btn.style.background = '#c60';
    btn.disabled = false;
    console.error('[streaming] WebSocket error — is stream-server.js running?');
  };
}

function _pickMime() {
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
}

