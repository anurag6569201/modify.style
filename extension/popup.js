/**
 * DemoForge popup — live status + start/stop.
 *
 * Reads recording state from chrome.storage.local (the background service
 * worker is the single source of truth) and detects whether the DemoForge
 * web app is open, so the user always knows why a button is disabled.
 */

const APP_URLS = ['http://localhost:8080/*', 'http://127.0.0.1:8080/*'];
const APP_HOME = 'http://localhost:8080/dashboard';

const el = (id) => document.getElementById(id);
let timerInterval = null;

/* ---------- Status rendering ---------- */

async function findAppTab() {
  const tabs = await chrome.tabs.query({ url: APP_URLS });
  return tabs[0] ?? null;
}

function renderRecording(isRecording, startTime) {
  const dot = el('rec-dot');
  const status = el('rec-status');
  const start = el('start');
  const stop = el('stop');

  clearInterval(timerInterval);

  if (isRecording) {
    dot.className = 'dot rec';
    start.style.display = 'none';
    stop.style.display = 'block';

    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - (startTime || Date.now())) / 1000));
      const m = Math.floor(s / 60);
      status.innerHTML = `<span class="timer">● ${m}:${String(s % 60).padStart(2, '0')}</span>`;
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  } else {
    dot.className = 'dot';
    status.textContent = 'Idle';
    start.style.display = 'block';
    stop.style.display = 'none';
  }
}

async function refresh() {
  const [appTab, store] = await Promise.all([
    findAppTab(),
    chrome.storage.local.get(['isRecording', 'recordingStartTime']),
  ]);

  const appDot = el('app-dot');
  const appStatus = el('app-status');
  const hint = el('hint');

  if (appTab) {
    appDot.className = 'dot ok';
    appStatus.textContent = 'Connected';
    el('start').disabled = false;
    hint.innerHTML = 'Records the true viewport cursor for buttery-smooth auto-zoom.';
  } else {
    appDot.className = 'dot bad';
    appStatus.textContent = 'Not open';
    el('start').disabled = true;
    hint.innerHTML = `Open <a href="#" id="open-app">DemoForge</a> first, then start recording from here.`;
    el('open-app')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: APP_HOME });
    });
  }

  renderRecording(Boolean(store.isRecording), store.recordingStartTime);
}

/* ---------- Actions ---------- */

el('start').addEventListener('click', async () => {
  try {
    const appTab = await findAppTab();
    if (!appTab?.id) return refresh();

    await chrome.tabs
      .sendMessage(appTab.id, { action: 'requestScreenSelection' })
      .catch(async () => {
        // Content scripts not yet injected (e.g. app opened before install).
        await chrome.scripting.executeScript({
          target: { tabId: appTab.id },
          files: ['demoforge-inject.js', 'content-script.js'],
        });
        await new Promise((r) => setTimeout(r, 200));
        await chrome.tabs.sendMessage(appTab.id, { action: 'requestScreenSelection' });
      });

    // Bring the app forward so the picker is visible, then close the popup.
    await chrome.tabs.update(appTab.id, { active: true });
    window.close();
  } catch (error) {
    console.error('[Extension] Failed to start:', error);
  }
});

el('stop').addEventListener('click', async () => {
  try {
    chrome.runtime.sendMessage({ action: 'stopRecording' }).catch(() => {});
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'stopRecording' }).catch(() => {});
    }
  } catch (error) {
    console.error('[Extension] Failed to stop recording:', error);
  } finally {
    setTimeout(refresh, 300);
  }
});

/* ---------- Live updates while popup is open ---------- */

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && ('isRecording' in changes || 'recordingStartTime' in changes)) {
    refresh();
  }
});

refresh();
