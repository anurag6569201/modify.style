const DB_NAME = 'ScreenRecorderDB';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('Database error: ' + event.target.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
}

export function saveVideo(blob, mouseData = []) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const id = 'latest_recording';
      const request = store.put({ id, blob, mouseData, timestamp: Date.now() });

      request.onsuccess = () => resolve(id);
      request.onerror = (e) => reject(e.target.error);
    } catch (e) {
      reject(e);
    }
  });
}

export function getVideo(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result ? request.result.blob : null);
      request.onerror = (e) => reject(e.target.error);
    } catch (e) {
      reject(e);
    }
  });
}
