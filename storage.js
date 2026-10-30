const DB_NAME = 'png-duty-offline-v1';
const STORE = 'snapshots';
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveSnapshot(snapshot) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(snapshot, 'latest');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function loadSnapshot() {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get('latest');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}
export async function clearSnapshot() {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export function getPreference(name, fallback) {
  try { const raw = localStorage.getItem('png-duty-' + name); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; }
}
export function setPreference(name, value) {
  localStorage.setItem('png-duty-' + name, JSON.stringify(value));
}
export function clearPreferences() {
  for(const key of Object.keys(localStorage)) if(key.startsWith('png-duty-')) localStorage.removeItem(key);
}
