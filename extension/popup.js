document.getElementById('start').addEventListener('click', async () => {
  try {
    // Find DemoForge tab
    const tabs = await chrome.tabs.query({ url: ['http://localhost:8080/*', 'http://127.0.0.1:8080/*'] });
    const demoforgeTab = tabs[0];
    
    if (demoforgeTab && demoforgeTab.id) {
      // Send message to DemoForge page to trigger screen selection
      chrome.tabs.sendMessage(demoforgeTab.id, { action: 'requestScreenSelection' }).catch(async () => {
        // Inject scripts if needed
        await chrome.scripting.executeScript({
          target: { tabId: demoforgeTab.id },
          files: ['demoforge-inject.js', 'content-script.js']
        });
        await new Promise(resolve => setTimeout(resolve, 200));
        chrome.tabs.sendMessage(demoforgeTab.id, { action: 'requestScreenSelection' });
      });
    } else {
      alert('Please open DemoForge (localhost:8080) first');
    }
  } catch (error) {
    console.error('[Extension] Failed:', error);
  }
});

document.getElementById('stop').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'stopRecording' }).catch((error) => {
        console.warn('[Extension] Could not send stopRecording:', error);
      });
    }
  } catch (error) {
    console.error('[Extension] Failed to stop recording:', error);
  }
});

