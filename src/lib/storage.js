/*
 * Persistence layer. Uses the artifact storage API (window.storage) when the
 * app runs inside an environment that provides it. Outside that environment
 * (hosted or local builds) it falls back to IndexedDB so data still survives
 * reloads, and finally to an in-memory map. No localStorage or sessionStorage
 * is used anywhere.
 */

const memoryStore = new Map();

function artifactStorage() {
  if (typeof window === "undefined") return null;
  const s = window.storage;
  if (s && typeof s.get === "function" && typeof s.set === "function") return s;
  return null;
}

const IDB_NAME = "thamini";
const IDB_STORE = "kv";
let idbPromise = null;

function hasIndexedDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openIdb() {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (!idbPromise) {
    idbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return idbPromise;
}

function idbRequest(mode, fn) {
  return openIdb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) {
          resolve({ ok: false });
          return;
        }
        try {
          const tx = db.transaction(IDB_STORE, mode);
          const req = fn(tx.objectStore(IDB_STORE));
          req.onsuccess = () => resolve({ ok: true, value: req.result });
          req.onerror = () => resolve({ ok: false });
        } catch {
          resolve({ ok: false });
        }
      })
  );
}

export function isPersistent() {
  return artifactStorage() !== null || hasIndexedDb();
}

export async function storageGet(key, fallback = null) {
  try {
    const store = artifactStorage();
    let raw;
    if (store) {
      const result = await store.get(key);
      if (result === null || result === undefined) return fallback;
      raw = typeof result === "object" && result !== null && "value" in result ? result.value : result;
    } else {
      const idb = await idbRequest("readonly", (os) => os.get(key));
      if (idb.ok) {
        if (idb.value === undefined || idb.value === null) return fallback;
        raw = idb.value;
      } else {
        if (!memoryStore.has(key)) return fallback;
        raw = memoryStore.get(key);
      }
    }
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw !== "string") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch (err) {
    console.warn(`storageGet failed for ${key}`, err);
    return fallback;
  }
}

export async function storageSet(key, value) {
  try {
    const serialized = JSON.stringify(value);
    const store = artifactStorage();
    if (store) {
      await store.set(key, serialized);
    } else {
      const idb = await idbRequest("readwrite", (os) => os.put(serialized, key));
      if (!idb.ok) memoryStore.set(key, serialized);
    }
    return true;
  } catch (err) {
    console.warn(`storageSet failed for ${key}`, err);
    return false;
  }
}

export async function storageDelete(key) {
  try {
    const store = artifactStorage();
    if (store && typeof store.delete === "function") {
      await store.delete(key);
    } else {
      const idb = await idbRequest("readwrite", (os) => os.delete(key));
      if (!idb.ok) memoryStore.delete(key);
    }
    return true;
  } catch (err) {
    console.warn(`storageDelete failed for ${key}`, err);
    return false;
  }
}

/* Append an entry to a stored list, keeping the newest first and capping length. */
export async function storageAppend(key, entry, cap = 25) {
  try {
    const list = (await storageGet(key, [])) || [];
    const next = [entry, ...list].slice(0, cap);
    await storageSet(key, next);
    return next;
  } catch (err) {
    console.warn(`storageAppend failed for ${key}`, err);
    return [entry];
  }
}

export const KEYS = {
  apiKey: "thamini:apiKey",
  watchlist: "thamini:watchlist",
  pinnedSectors: "thamini:pinnedSectors",
  dismissedAlerts: "thamini:dismissedAlerts",
  onboarding: (tab) => `thamini:onboardingDismissed:${tab}`,
  companyNotes: (company) => `thamini:companyNotes:${company}`,
  companyHistory: (company) => `thamini:companyHistory:${company}`,
  questionAnswers: (company, ts) => `thamini:questionAnswers:${company}:${ts}`,
  sectorNotes: (sector) => `thamini:sectorNotes:${sector}`,
  sectorHistory: (sector) => `thamini:sectorHistory:${sector}`,
  sectorLatest: (sector) => `thamini:sectorLatest:${sector}`,
  macroNotes: "thamini:macroNotes",
  macroSnapshot: "thamini:macroSnapshot",
};
