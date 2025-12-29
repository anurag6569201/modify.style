import { getVideo } from './db.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Controls
const inputAspect = document.getElementById('aspectRatio');
const inputPadding = document.getElementById('paddingInput');
const inputRadius = document.getElementById('radiusInput');
const inputShadow = document.getElementById('shadowInput');
const inputBg = document.getElementById('bgInput');
const inputBgGradient = document.getElementById('bgGradient');
const inputBgImage = document.getElementById('bgImage');
const inputWindowStyle = document.getElementById('windowStyle');
const inputWatermarkUpload = document.getElementById('watermarkUpload');
const inputWatermarkPos = document.getElementById('watermarkPos');
const inputWatermarkOpacity = document.getElementById('watermarkOpacity');

const btnPlay = document.getElementById('playBtn');
const btnExport = document.getElementById('exportBtn');

// State
let videoBlob = null;
let videoEl = document.createElement('video');
videoEl.loop = true; 
let isPlaying = false;
let animationId;
let bgImgObj = null;
let watermarkImgObj = null;

const gradients = {
    sunset: ['#ff9a9e', '#fecfef'],
    ocean: ['#2b5876', '#4e4376'],
    neon: ['#00c6ff', '#0072ff'],
    berry: ['#c94b4b', '#4b134f'],
    midnight: ['#232526', '#414345']
};

let config = {
  aspect: 'auto',
  padding: 60,
  radius: 12,
  shadow: 40,
  bgColor: '#1e1e1e',
  bgGradient: 'none',
  bgType: 'color', // color, gradient, image
  windowStyle: 'none',
  watermarkPos: 'br',
  watermarkOpacity: 0.8
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
  
  inputBg.addEventListener('input', (e) => { config.bgColor = e.target.value; config.bgType = 'color'; update(); });
  inputBgGradient.addEventListener('change', (e) => { config.bgGradient = e.target.value; config.bgType = 'gradient'; update(); });
  
  inputBgImage.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => { bgImgObj = img; config.bgType = 'image'; update(); };
              img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
      }
  });

  inputWindowStyle.addEventListener('change', (e) => { config.windowStyle = e.target.value; update(); });
  
  inputWatermarkUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => { watermarkImgObj = img; update(); };
              img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
      }
  });
  
  inputWatermarkPos.addEventListener('change', (e) => { config.watermarkPos = e.target.value; update(); });
  inputWatermarkOpacity.addEventListener('input', (e) => { config.watermarkOpacity = parseInt(e.target.value) / 100; update(); });

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
  if (config.bgType === 'image' && bgImgObj) {
      // Draw image cover
      const imgRatio = bgImgObj.width / bgImgObj.height;
      const canvasRatio = w / h;
      let dw, dh, dx, dy;
      if (canvasRatio > imgRatio) {
          dw = w; dh = w / imgRatio; dx = 0; dy = (h - dh) / 2;
      } else {
          dh = h; dw = h * imgRatio; dy = 0; dx = (w - dw) / 2;
      }
      ctx.drawImage(bgImgObj, dx, dy, dw, dh);
  } else if (config.bgType === 'gradient' && config.bgGradient !== 'none') {
      const g = ctx.createLinearGradient(0, 0, w, h);
      const colors = gradients[config.bgGradient];
      if (colors) {
          g.addColorStop(0, colors[0]);
          g.addColorStop(1, colors[1]);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
      } else {
           ctx.fillStyle = config.bgColor;
           ctx.fillRect(0, 0, w, h);
      }
  } else {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);
  }
  
  // 2. Video Placement
  const vW = videoEl.videoWidth;
  const vH = videoEl.videoHeight;
  
  // Center Video
  const x = (w - vW) / 2;
  const y = (h - vH) / 2;
  
  ctx.save();
  
  // 3. Shadow
  if (config.shadow > 0) {
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = config.shadow * 1.5;
    ctx.shadowOffsetY = config.shadow * 0.5;
  }
  
  // 4. Rounded Corners & Clip
  roundedRect(ctx, x, y, vW, vH, config.radius);
  ctx.fillStyle = "#000"; // Dummy fill for shadow
  ctx.fill(); 
  
  ctx.shadowColor = "transparent";
  
  ctx.clip(); 
  
  // 5. Draw Video
  ctx.drawImage(videoEl, x, y, vW, vH);
  
  ctx.restore();

  // 6. Window Controls (Drawn ON TOP of video, but after clip restore? No, they need to be on top)
  if (config.windowStyle !== 'none') {
      drawWindowControls(ctx, x, y, vW, config.windowStyle);
  }
  
  // 7. Watermark
  if (watermarkImgObj) {
      drawWatermark(ctx, w, h);
  }
}

function drawWindowControls(ctx, x, y, width, style) {
    const padding = 20; // from left/top of video
    const startX = x + padding;
    const startY = y + padding;
    const gap = 8;
    const size = 12;
    
    if (style === 'mac_dark' || style === 'mac_light') {
        const colors = ['#FF5F56', '#FFBD2E', '#27C93F'];
        colors.forEach((c, i) => {
            ctx.beginPath();
            ctx.arc(startX + (i * (size + gap)), startY, size / 2, 0, Math.PI * 2);
            ctx.fillStyle = c;
            ctx.fill();
            ctx.closePath();
        });
    } else if (style === 'win') {
        // Simple Windows style controls helper (just squares/placeholders for now to look cleaner)
        // Draw 3 rectangles at top right
        const ctrlW = 40;
        const ctrlH = 30;
        // top right of video
        let wx = x + width - (ctrlW * 3);
        let wy = y;
        
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(wx, wy, ctrlW, ctrlH); // min
        ctx.fillRect(wx + ctrlW, wy, ctrlW, ctrlH); // max
        ctx.fillStyle = '#e81123';
        ctx.fillRect(wx + ctrlW*2, wy, ctrlW, ctrlH); // close (red)
        
        // details
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        
        // min
         ctx.beginPath(); ctx.moveTo(wx + 15, wy + 15); ctx.lineTo(wx + 25, wy + 15); ctx.stroke();
         // max (box)
         ctx.strokeRect(wx + ctrlW + 15, wy + 10, 10, 10);
         // close (X)
         ctx.beginPath(); 
         ctx.moveTo(wx + ctrlW*2 + 15, wy + 10); ctx.lineTo(wx + ctrlW*2 + 25, wy + 20);
         ctx.moveTo(wx + ctrlW*2 + 25, wy + 10); ctx.lineTo(wx + ctrlW*2 + 15, wy + 20);
         ctx.stroke();
    }
}

function drawWatermark(ctx, w, h) {
    if (!watermarkImgObj) return;
    
    const targetSize = Math.min(w, h) * 0.15; // 15% of screen size max
    const imgRatio = watermarkImgObj.width / watermarkImgObj.height;
    let dw = targetSize;
    let dh = targetSize / imgRatio;
    
    if (imgRatio < 1) { // Tall image
        dh = targetSize;
        dw = targetSize * imgRatio;
    }
    
    const margin = 40;
    let dx, dy;
    
    switch (config.watermarkPos) {
        case 'tl': dx = margin; dy = margin; break;
        case 'tr': dx = w - dw - margin; dy = margin; break;
        case 'bl': dx = margin; dy = h - dh - margin; break;
        case 'br': dx = w - dw - margin; dy = h - dh - margin; break;
        case 'center': dx = (w - dw) / 2; dy = (h - dh) / 2; break;
        default: dx = w - dw - margin; dy = h - dh - margin;
    }
    
    ctx.save();
    ctx.globalAlpha = config.watermarkOpacity;
    ctx.drawImage(watermarkImgObj, dx, dy, dw, dh);
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
