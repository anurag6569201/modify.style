import { getVideo } from './db.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Controls
const inputAspect = document.getElementById('aspectRatio');
const inputPadding = document.getElementById('paddingInput');
const inputRadius = document.getElementById('radiusInput');
const inputShadow = document.getElementById('shadowInput');
const inputBg = document.getElementById('bgInput');

const btnPlay = document.getElementById('playBtn');
const btnExport = document.getElementById('exportBtn');

// State
let videoBlob = null;
let videoEl = document.createElement('video');
videoEl.loop = true; // Loop for easier editing
let isPlaying = false;
let animationId;

let config = {
  aspect: 'auto',
  padding: 60,
  radius: 12,
  shadow: 40,
  bgColor: '#1e1e1e'
};

// Initialization
async function init() {
  const blob = await getVideo('latest_recording');
  if (!blob) return alert('No recording found!');
  
  videoBlob = blob;
  videoEl.src = URL.createObjectURL(blob);
  
  videoEl.onloadedmetadata = () => {
    resizeCanvas();
    drawFrame();
  };
  
  setupListeners();
}

function setupListeners() {
  const update = () => {
    if (!isPlaying) requestAnimationFrame(drawFrame);
  };
  
  inputAspect.addEventListener('change', (e) => { config.aspect = e.target.value; resizeCanvas(); update(); });
  inputPadding.addEventListener('input', (e) => { config.padding = parseInt(e.target.value); resizeCanvas(); update(); });
  inputRadius.addEventListener('input', (e) => { config.radius = parseInt(e.target.value); update(); });
  inputShadow.addEventListener('input', (e) => { config.shadow = parseInt(e.target.value); update(); });
  inputBg.addEventListener('input', (e) => { config.bgColor = e.target.value; update(); });
  
  btnPlay.addEventListener('click', togglePlay);
  btnExport.addEventListener('click', exportVideo);
}

function getAspectRatioMultiple() {
  if (config.aspect === 'auto') return 0;
  const parts = config.aspect.split(':');
  return parseInt(parts[0]) / parseInt(parts[1]);
}

function resizeCanvas() {
  const vW = videoEl.videoWidth;
  const vH = videoEl.videoHeight;
  
  // Calculate Target Size
  let targetW = vW + (config.padding * 2);
  let targetH = vH + (config.padding * 2);
  
  const ratio = getAspectRatioMultiple();
  if (ratio > 0) {
    // If fixed ratio, enforce it via padding or crop (here we expand background to fit ratio)
    // We want the video to fit INSIDE the "padded" area.
    // Simplest Pro approach: Canvas becomes the requested ratio, video centers in it.
    // Let's base it on width.
    const currentRatio = targetW / targetH;
    
    if (currentRatio > ratio) {
      // Too wide, increase height
      targetH = targetW / ratio;
    } else {
      // Too tall, increase width
      targetW = targetH * ratio;
    }
  }
  
  canvas.width = targetW;
  canvas.height = targetH;
}

function drawFrame() {
  const w = canvas.width;
  const h = canvas.height;
  
  // 1. Background
  ctx.fillStyle = config.bgColor;
  ctx.fillRect(0, 0, w, h);
  
  // 2. Video Placement
  // We want to draw the video centered, with current padding setting (relative to video size)
  // Re-calculate video rect to center it.
  const vW = videoEl.videoWidth;
  const vH = videoEl.videoHeight;
  
  const x = (w - vW) / 2;
  const y = (h - vH) / 2;
  
  ctx.save();
  
  // 3. Shadow
  if (config.shadow > 0) {
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = config.shadow * 1.5;
    ctx.shadowOffsetY = config.shadow * 0.5;
  }
  
  // 4. Rounded Corners (Clipping)
  // We need to draw a rounded rect path for the clip
  roundedRect(ctx, x, y, vW, vH, config.radius);
  // Fill with shadow first (hack to get shadow behind clip)
  // Context shadow applies to fill/stroke.
  ctx.fillStyle = "#000"; // Dummy fill to cast shadow
  ctx.fill(); 
  
  ctx.shadowColor = "transparent"; // Reset shadow so video isn't blurred
  
  // Clip for the video
  ctx.clip(); 
  
  // 5. Draw Video
  ctx.drawImage(videoEl, x, y, vW, vH);
  
  ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function renderLoop() {
  if (isPlaying || !videoEl.paused) {
    drawFrame();
    animationId = requestAnimationFrame(renderLoop);
  }
}

function togglePlay() {
  if (videoEl.paused) {
    videoEl.play();
    btnPlay.innerText = "Pause";
    isPlaying = true;
    renderLoop();
  } else {
    videoEl.pause();
    btnPlay.innerText = "Play";
    isPlaying = false;
    cancelAnimationFrame(animationId);
    drawFrame(); // Draw one static frame
  }
}

function exportVideo() {
  btnExport.innerText = "Rendering...";
  btnExport.disabled = true;
  
  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
  const chunks = [];
  
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-pro-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    btnExport.innerText = "Export Video";
    btnExport.disabled = false;
    videoEl.currentTime = 0;
    videoEl.pause();
    isPlaying = false;
    btnPlay.innerText = "Play";
    drawFrame();
  };
  
  videoEl.currentTime = 0;
  videoEl.play();
  recorder.start();
  
  function recordLoop() {
    if (!videoEl.paused && videoEl.currentTime < videoEl.duration) {
      drawFrame();
      requestAnimationFrame(recordLoop);
    } else {
      recorder.stop();
    }
  }
  recordLoop(); // Note: if looping is true, this logic needs a hard stop.
  // For export, we should temporarily disable loop.
  const oldLoop = videoEl.loop;
  videoEl.loop = false;
  
  // Hook restore loop
  const _onstop = recorder.onstop;
  recorder.onstop = (e) => {
      videoEl.loop = oldLoop;
      if (_onstop) _onstop(e);
  }
}

init();
