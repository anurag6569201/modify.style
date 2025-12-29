import { saveVideo } from './db.js';

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

const selectScreenBtn = document.getElementById('selectScreenBtn');
const startRecordingBtn = document.getElementById('startRecordingBtn');
const preview = document.getElementById('preview');
const statusText = document.querySelector('#step3 .step-desc');
const errorMsg = document.getElementById('errorMsg');

let stream = null;
let mediaRecorder = null;
let recordedChunks = [];

// Step 1: Select Screen
selectScreenBtn.addEventListener('click', async () => {
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { 
          mediaSource: "screen",
          displaySurface: "browser" // Encourages tab selection
      },
      audio: false
    });
    
    preview.srcObject = stream;
    preview.style.display = 'block';
    
    // Move to next steps visually
    step1.classList.remove('active');
    step1.style.opacity = '0.5';
    
    step2.classList.add('active');
    step2.style.opacity = '1';
    
    // Just a small delay to simulate user looking at step 2, then activate step 3 capability
    setTimeout(() => {
        step2.classList.remove('active');
        step2.style.opacity = '0.5';
        
        step3.classList.add('active');
        step3.style.opacity = '1';
        startRecordingBtn.disabled = false;
    }, 1500);

    // Initial track setup
    stream.getVideoTracks()[0].onended = () => {
       // User stopped sharing via browser UI
       // If we are recording, we should stop and save!
       if (mediaRecorder && mediaRecorder.state === 'recording') {
           mediaRecorder.stop();
       } else {
           resetUI();
       }
    };

  } catch (err) {
    console.error("Error selecting screen:", err);
    errorMsg.style.display = 'block';
    errorMsg.innerText = "Selection cancelled. Please try again.";
  }
});

// Step 3: Start/Stop Recording
startRecordingBtn.addEventListener('click', () => {
    if (!stream) return;
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    } else {
        startRecording(stream);
    }
});


async function startRecording(stream) {
  // Notify background/content scripts to track mouse
  try {
      chrome.runtime.sendMessage({ action: "START_TRACKING" }, () => {
          if (chrome.runtime.lastError) {
              console.log("Tracking ignored:", chrome.runtime.lastError.message);
          }
      });
  } catch(e) { console.warn(e); }

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = saveAndRedirect;
  mediaRecorder.start();
  
  // Transition UI
  startRecordingBtn.innerText = "Stop Recording";
  startRecordingBtn.classList.remove('btn-primary');
  startRecordingBtn.classList.add('btn-danger'); // Red
  startRecordingBtn.classList.add('recording-pulse');
  
  statusText.innerHTML = "Recording in progress...<br>Click 'Stop Recording' below or 'Stop Sharing' in the floating bar.";
  
  errorMsg.style.display = 'block';
  errorMsg.style.color = '#4ade80'; // Green
  errorMsg.style.borderColor = 'rgba(74, 222, 128, 0.3)';
  errorMsg.style.background = 'rgba(74, 222, 128, 0.1)';
  errorMsg.innerText = "Recording started! Switch to your tab.";
}

async function saveAndRedirect() {
    startRecordingBtn.innerText = "Saving...";
    startRecordingBtn.disabled = true;
    startRecordingBtn.classList.remove('recording-pulse');
    
    if (recordedChunks.length === 0) {
        errorMsg.style.display = 'block';
        errorMsg.style.color = '#fca5a5';
        errorMsg.innerText = "No data recorded. Did you select a screen?";
        startRecordingBtn.disabled = false;
        startRecordingBtn.innerText = "Start Recording";
        return;
    }

    // safely get mouse data
    let mouseData = [];
    try {
        const mousePromise = new Promise((resolve) => {
             chrome.runtime.sendMessage({ action: "STOP_TRACKING" }, (response) => {
                 if (chrome.runtime.lastError) resolve([]);
                 else resolve(response?.data || []);
             });
             setTimeout(() => resolve([]), 1000); 
        });
        mouseData = await mousePromise;
    } catch (e) { console.warn("Failed to get mouse data", e); }

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    
    try {
        await saveVideo(blob, mouseData);
        window.location.href = "editor.html";
    } catch (err) {
        console.error(err);
        errorMsg.style.display = 'block';
        errorMsg.innerText = "Error saving video: " + err.message;
        errorMsg.style.color = 'red';
        startRecordingBtn.innerText = "Retry Save";
        startRecordingBtn.disabled = false;
    }
}

function resetUI() {
    stream = null;
    preview.srcObject = null;
    preview.style.display = 'none';
    step1.classList.add('active');
    step1.style.opacity = '1';
    
    step2.classList.remove('active');
    step2.style.opacity = '0.4';
    step3.classList.remove('active');
    step3.style.opacity = '0.4';
    
    startRecordingBtn.disabled = true;
    startRecordingBtn.innerText = "Start Recording";
    startRecordingBtn.classList.remove('btn-danger');
    startRecordingBtn.classList.add('btn-primary');
}
