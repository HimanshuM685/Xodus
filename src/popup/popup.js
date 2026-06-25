/* =============================================================================
 * Xodus — popup.js  (ES module)
 * -----------------------------------------------------------------------------
 * Drives the popup UI: collect controls, live progress, and the three exports.
 * All heavy lifting lives elsewhere — the popup just orchestrates and reports.
 * ===========================================================================*/
import {
  KEYS,
  get,
  getBookmarks,
  getBookmarksCount,
  clearBookmarks,
  getSettings,
} from '../lib/storage.js';
import { downloadCsv } from '../export/csv.js';
import { toMarkdown } from '../export/markdown.js';

const $ = (id) => document.getElementById(id);
const els = {
  banner: $('banner'),
  count: $('count'),
  state: $('state'),
  collect: $('collect'),
  stop: $('stop'),
  collectHint: $('collect-hint'),
  csv: $('csv'),
  markdown: $('markdown'),
  notion: $('notion'),
  notionStatus: $('notion-status'),
  clear: $('clear'),
  settings: $('settings'),
  toast: $('toast'),
};

// --- helpers ----------------------------------------------------------------
function toast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle('err', isError);
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 2600);
}

function showBanner(html) {
  els.banner.innerHTML = html;
  els.banner.classList.remove('hidden');
}
function hideBanner() {
  els.banner.classList.add('hidden');
}

function setState(state) {
  els.state.textContent = state || 'idle';
  const collecting = state === 'collecting';
  els.collect.classList.toggle('hidden', collecting);
  els.stop.classList.toggle('hidden', !collecting);
}

async function getActiveXTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return { tab: null, isX: false };
  const isX = /^https:\/\/(x|twitter)\.com\//.test(tab.url);
  return { tab, isX };
}

/** Ask the content script where we are. Returns null if no content script. */
async function pingContentScript(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'XODUS_PING' });
  } catch (_) {
    return null; // no content script on this tab (not an X page, or not loaded)
  }
}

// --- environment / banner ----------------------------------------------------
async function refreshEnvironment() {
  const { tab, isX } = await getActiveXTab();
  if (!isX) {
    showBanner(
      'Open <strong>x.com/i/bookmarks</strong> in this tab to collect. ' +
        'You can still export anything already collected.'
    );
    els.collect.disabled = true;
    return;
  }
  const ping = tab ? await pingContentScript(tab.id) : null;
  if (!ping) {
    showBanner(
      'Loaded on X, but the content script isn’t active yet. ' +
        'Reload the X tab and reopen Xodus.'
    );
    els.collect.disabled = true;
    return;
  }
  if (!ping.onBookmarksPage) {
    showBanner(
      'You’re on X but not on the bookmarks page. ' +
        'Go to <strong>x.com/i/bookmarks</strong>, then press Collect.'
    );
    els.collect.disabled = false; // allow attempt; bridge double-checks
    return;
  }
  hideBanner();
  els.collect.disabled = false;
}

// --- refresh counts / status -------------------------------------------------
async function refreshCounts() {
  const count = await getBookmarksCount();
  els.count.textContent = count;
  const status = await get(KEYS.COLLECT_STATUS, { state: 'idle' });
  setState(status.state);

  const hasData = count > 0;
  els.csv.disabled = !hasData;
  els.markdown.disabled = !hasData;
  els.notion.disabled = !hasData;
}

function renderNotionStatus(status) {
  if (!status) {
    els.notionStatus.classList.add('hidden');
    return;
  }
  els.notionStatus.classList.remove('hidden', 'ok', 'err');
  if (status.state === 'pushing') {
    els.notionStatus.textContent = `Pushing to Notion… ${status.pushed || 0}/${
      status.total || 0
    } (${status.failed || 0} failed)`;
  } else if (status.state === 'done') {
    els.notionStatus.classList.add('ok');
    els.notionStatus.textContent = `Done — ${status.pushed} pushed, ${status.failed} failed.`;
    els.notion.disabled = false;
  } else if (status.state === 'error') {
    els.notionStatus.classList.add('err');
    els.notionStatus.textContent = `Notion error: ${status.error}`;
    els.notion.disabled = false;
  }
}

// --- actions -----------------------------------------------------------------
async function startCollect() {
  const { tab, isX } = await getActiveXTab();
  if (!isX || !tab) {
    toast('Open x.com/i/bookmarks first.', true);
    return;
  }
  const resp = await chrome.tabs.sendMessage(tab.id, {
    type: 'XODUS_START_COLLECT',
  });
  if (!resp || !resp.ok) {
    if (resp && resp.error === 'not_on_bookmarks_page') {
      toast('Navigate to x.com/i/bookmarks, then Collect.', true);
    } else {
      toast('Could not start collecting. Reload the X tab.', true);
    }
    return;
  }
  setState('collecting');
}

async function stopCollect() {
  const { tab } = await getActiveXTab();
  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'XODUS_STOP_COLLECT' });
    } catch (_) {}
  }
  setState('stopped');
}

async function doCsv() {
  const bookmarks = await getBookmarks();
  if (!bookmarks.length) return toast('Nothing to export yet.', true);
  const filename = downloadCsv(bookmarks);
  toast(`Saved ${filename}`);
}

async function doMarkdown() {
  const bookmarks = await getBookmarks();
  if (!bookmarks.length) return toast('Nothing to export yet.', true);
  const md = toMarkdown(bookmarks);
  try {
    await navigator.clipboard.writeText(md);
    toast(`Copied ${bookmarks.length} bookmarks as Markdown`);
  } catch (_) {
    toast('Clipboard blocked — see console.', true);
    console.log(md);
  }
}

async function doNotion() {
  const settings = await getSettings();
  if (!settings.notionToken) {
    toast('Add your Notion token in Settings first.', true);
    chrome.runtime.openOptionsPage();
    return;
  }
  if (!settings.parentPageId && !settings.databaseId) {
    toast('Add a Notion parent page id in Settings.', true);
    chrome.runtime.openOptionsPage();
    return;
  }
  els.notion.disabled = true;
  els.notionStatus.classList.remove('hidden');
  els.notionStatus.textContent = 'Starting Notion push…';
  const resp = await chrome.runtime.sendMessage({ type: 'XODUS_NOTION_PUSH' });
  if (resp && !resp.ok) {
    renderNotionStatus({ state: 'error', error: resp.error });
  }
}

async function doClear() {
  if (!confirm('Delete all collected bookmarks from this extension?')) return;
  await clearBookmarks();
  await refreshCounts();
  renderNotionStatus(null);
  toast('Collected data cleared.');
}

// --- live updates ------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'XODUS_COLLECT_PROGRESS') {
    els.count.textContent = msg.count;
    setState(msg.state);
    refreshCounts();
  } else if (msg.type === 'XODUS_NOTION_PROGRESS') {
    renderNotionStatus(msg.status);
  }
});

// --- wire up -----------------------------------------------------------------
els.collect.addEventListener('click', startCollect);
els.stop.addEventListener('click', stopCollect);
els.csv.addEventListener('click', doCsv);
els.markdown.addEventListener('click', doMarkdown);
els.notion.addEventListener('click', doNotion);
els.clear.addEventListener('click', doClear);
els.settings.addEventListener('click', () => chrome.runtime.openOptionsPage());

(async function init() {
  await refreshCounts();
  await refreshEnvironment();
  // Reflect any push that may still be running in the service worker.
  const { status } = (await chrome.runtime.sendMessage({
    type: 'XODUS_NOTION_STATUS',
  })) || {};
  if (status && status.state === 'pushing') renderNotionStatus(status);
})();
