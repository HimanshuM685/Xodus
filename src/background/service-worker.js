/* =============================================================================
 * Xodus — service-worker.js  (MV3 background, ES module)
 * -----------------------------------------------------------------------------
 * Runs the Notion push off the popup's lifetime. The popup may close mid-push,
 * so the actual work happens here and progress is mirrored into storage
 * (NOTION_STATUS) as well as broadcast to any open popup.
 * ===========================================================================*/
import { KEYS, get, set, getBookmarks, getSettings } from '../lib/storage.js';
import { pushToNotion } from '../export/notion.js';

let pushInFlight = false;

function broadcast(status) {
  // Best-effort: a closed popup simply has no listener.
  chrome.runtime
    .sendMessage({ type: 'XODUS_NOTION_PROGRESS', status })
    .catch(() => {});
}

async function updateStatus(status) {
  await set(KEYS.NOTION_STATUS, { ...status, lastUpdated: Date.now() });
  broadcast(status);
}

async function handleNotionPush(forceNewDatabase) {
  if (pushInFlight) {
    return { ok: false, error: 'A push is already running.' };
  }
  pushInFlight = true;
  try {
    const settings = await getSettings();
    const bookmarks = await getBookmarks();

    if (!bookmarks.length) {
      const err = 'No bookmarks collected yet.';
      await updateStatus({ state: 'error', error: err });
      return { ok: false, error: err };
    }

    await updateStatus({
      state: 'pushing',
      pushed: 0,
      failed: 0,
      total: bookmarks.length,
    });

    const result = await pushToNotion({
      token: settings.notionToken,
      parentPageId: settings.parentPageId,
      databaseId: forceNewDatabase ? undefined : settings.databaseId,
      forceNewDatabase,
      bookmarks,
      onProgress: (p) => {
        updateStatus({ state: 'pushing', ...p });
      },
    });

    // Persist the database id so future pushes append to the same DB.
    if (result.databaseId && result.databaseId !== settings.databaseId) {
      await set(KEYS.SETTINGS, { ...settings, databaseId: result.databaseId });
    }

    await updateStatus({ state: 'done', ...result });
    return { ok: true, result };
  } catch (e) {
    const error = (e && e.message) || String(e);
    await updateStatus({ state: 'error', error });
    return { ok: false, error };
  } finally {
    pushInFlight = false;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'XODUS_NOTION_PUSH') {
    handleNotionPush(!!msg.forceNewDatabase).then(sendResponse);
    return true; // async response
  }

  if (msg.type === 'XODUS_NOTION_STATUS') {
    get(KEYS.NOTION_STATUS, null).then((status) =>
      sendResponse({ ok: true, status })
    );
    return true;
  }
});
