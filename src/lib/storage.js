/* =============================================================================
 * Xodus — storage.js  (ES module; used by popup + service worker)
 * -----------------------------------------------------------------------------
 * Thin, promise-based wrappers around chrome.storage.local plus the canonical
 * storage-key constants. Content scripts do NOT import this (they can't use ES
 * modules); they talk to chrome.storage directly with the same keys.
 * ===========================================================================*/

export const KEYS = {
  BOOKMARKS: 'xodus_bookmarks', // { [tweet_id]: bookmark }
  SETTINGS: 'xodus_settings', // { notionToken, parentPageId, databaseId }
  COLLECT_STATUS: 'xodus_collect_status',
  NOTION_STATUS: 'xodus_notion_status',
};

export function get(key, fallback) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => {
      resolve(res[key] === undefined ? fallback : res[key]);
    });
  });
}

export function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

/** Return collected bookmarks as a plain array (insertion order undefined). */
export async function getBookmarks() {
  const map = await get(KEYS.BOOKMARKS, {});
  return Object.values(map);
}

export async function getBookmarksCount() {
  const map = await get(KEYS.BOOKMARKS, {});
  return Object.keys(map).length;
}

export async function clearBookmarks() {
  await set(KEYS.BOOKMARKS, {});
  await set(KEYS.COLLECT_STATUS, { count: 0, state: 'idle' });
}

export async function getSettings() {
  return await get(KEYS.SETTINGS, {
    notionToken: '',
    parentPageId: '',
    databaseId: '',
  });
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const merged = { ...current, ...partial };
  await set(KEYS.SETTINGS, merged);
  return merged;
}
