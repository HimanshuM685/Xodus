/* =============================================================================
 * Xodus — options.js  (ES module)
 * -----------------------------------------------------------------------------
 * Reads/writes the Notion settings. Normalizes the parent page ID (users tend
 * to paste a full Notion URL) into the dashed UUID Notion's API expects.
 * ===========================================================================*/
import { getSettings, saveSettings, KEYS, set } from '../lib/storage.js';

const $ = (id) => document.getElementById(id);
const tokenEl = $('token');
const parentEl = $('parent');
const dbDisplay = $('db-display');
const savedEl = $('saved');

/**
 * Accept a raw Notion page link or bare id and return a dashed 32-hex UUID.
 * Notion page URLs end with "…-<32 hex chars>"; the API accepts that id with
 * or without dashes, but we dash it for consistency.
 */
function normalizePageId(raw) {
  if (!raw) return '';
  const match = raw.replace(/[^a-fA-F0-9]/g, '').match(/[a-fA-F0-9]{32}$/);
  if (!match) return raw.trim(); // leave as-is; let Notion validate
  const hex = match[0].toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

function renderDb(databaseId) {
  if (databaseId) {
    dbDisplay.innerHTML = `Connected: <code>${databaseId}</code>`;
  } else {
    dbDisplay.textContent = 'No database created yet.';
  }
}

async function load() {
  const s = await getSettings();
  tokenEl.value = s.notionToken || '';
  parentEl.value = s.parentPageId || '';
  renderDb(s.databaseId);
}

async function save() {
  const parentPageId = normalizePageId(parentEl.value);
  parentEl.value = parentPageId;
  await saveSettings({
    notionToken: tokenEl.value.trim(),
    parentPageId,
  });
  savedEl.classList.remove('hidden');
  setTimeout(() => savedEl.classList.add('hidden'), 2000);
}

async function forgetDatabase() {
  const s = await getSettings();
  await set(KEYS.SETTINGS, { ...s, databaseId: '' });
  renderDb('');
}

$('save').addEventListener('click', save);
$('reset-db').addEventListener('click', forgetDatabase);

load();
