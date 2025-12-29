import { saveVideo } from './db.js';

let mediaRecorder;
let recordedChunks = [];
let stream;

const startBtn = document.getElementById('startRecBtn');
const stopBtn = document.getElementById('stopRecBtn');
const preview = document.getElementById('preview');
const status = document.getElementById('status');

startBtn.addEventListener('click', async () => {
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: "screen" },
      audio: true // Optional: system audio
    });

    preview.srcObject = stream;
    
    // Check if user cancelled system dialog
    stream.getVideoTracks()[0].onended = () => {
      stopRecording();
    };

    startRecording(stream);
    
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    status.innerText = "Recording in progress...";
    
  } catch (err) {
    console.error("Error: " + err);
    status.innerText = "Error: " + err.message;
  }
});

stopBtn.addEventListener('click', () => {
  if (stream) {
    let tracks = stream.getTracks();
    tracks.forEach(track => track.stop()); // This triggers the onended event if bound, but we call stopRecording explicitly too
  }
  stopRecording();
});


// Store the tab ID we are recording
let recordedTabId = null;

async function startRecording(stream) {
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

  // improved track settings
  const track = stream.getVideoTracks()[0];
  // Try to infer tab ID from the stream if possible, or assume active tab if initiated immediately
  // Note: getDisplayMedia doesn't give Tab ID easily. 
  // For this MVP, we will try to inject into the *active* tab right before we start, 
  // OR we can ask the background script to help. 
  // SIMPLIFICATION: We will assume the user selects the "Current Tab" or we just try to query active tab.
  // Actually, for robust "Cursorful" emulation, we usually need the user to be on a specific tab.
  // Let's try to get the active tab.
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Note: This 'tab' is the RECORDER tab. We need the tab being shared.
  // Since we can't easily know which tab is shared, we will skip injection if it's not a tab capture.
  // But for the sake of the demo, let's assume we want to inject into the tab the user navigated to.
  // TRICKY: getDisplayMedia picker handles selection.
  
  // ALTERNATIVE: accepted "hack" for MVP:
  // We cannot easily inject into the randomly selected stream source.
  // We will omit strict injection for now and focus just on the Canvas Editor (Backgrounds) 
  // unless we can solve the "which tab" problem. 
  // WAIT: User requirement is "like Cursorful". Cursorful asks you to pick a tab.
  // Let's stick to simple video + background first. The "content.js" is ready but might be unused if we can't target the tab.
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = saveAndRedirect;
  mediaRecorder.start();
}

async function saveAndRedirect() {
  status.innerText = "Saving recording...";
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  
  // We might capture mouse data here if we had a connection
  const mouseData = []; // Placeholder

  try {
    await saveVideo(blob, mouseData); // Update saveVideo signature in next step
    window.location.href = "editor.html";
  } catch (err) {
    status.innerText = "Failed to save video: " + err.message;
  }
}

