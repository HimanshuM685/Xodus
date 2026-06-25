/* =============================================================================
 * Xodus — xparser.js  (runs in the ISOLATED world content-script context)
 * -----------------------------------------------------------------------------
 * BRITTLE X-FRONTEND TOUCHPOINT #2 of 2 (the other is interceptor.js).
 *
 * THIS IS THE SINGLE FILE TO PATCH WHEN X CHANGES ITS RESPONSE SHAPE.
 * Everything that knows the structure of X's GraphQL bookmarks response lives
 * here and nowhere else. Every property access is wrapped in `safe()` so a
 * shape change degrades gracefully (we skip a tweet) instead of throwing.
 *
 * EXPECTED RESPONSE SHAPE (as observed at time of writing — may drift):
 *
 *   data
 *    └─ bookmark_timeline_v2
 *        └─ timeline
 *            └─ instructions: [
 *                 { type: "TimelineAddEntries", entries: [
 *                     {
 *                       entryId: "tweet-1234567890",           // a bookmark
 *                       content: { itemContent: {
 *                         tweet_results: { result: <Tweet> }
 *                       }}
 *                     },
 *                     { entryId: "cursor-bottom-...", ... }     // pagination
 *                 ]}
 *               ]
 *
 *   <Tweet> is either a "Tweet" object or a "TweetWithVisibilityResults"
 *   wrapper whose real tweet sits under `.tweet`. Useful fields:
 *     result.rest_id                                  -> tweet id
 *     result.legacy.full_text                         -> text
 *     result.legacy.created_at                        -> "Wed Oct 10 ... 2018"
 *     result.legacy.extended_entities.media[]         -> media
 *     result.legacy.quoted_status_permalink.expanded  -> quoted tweet url
 *     result.legacy.self_thread                        -> present if a thread
 *     result.core.user_results.result.legacy.screen_name / .name -> author
 *
 * To debug shape changes: in DevTools, paste a captured response into
 *   XodusParser.parseBookmarksResponse(JSON.parse(text))
 * and inspect what comes back.
 * ===========================================================================*/
globalThis.XodusParser = (function () {
  'use strict';

  /** Run `fn`, returning `fallback` if it throws or yields null/undefined. */
  function safe(fn, fallback) {
    try {
      const v = fn();
      return v === undefined || v === null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  /** Unwrap the TweetWithVisibilityResults envelope, if present. */
  function unwrapTweet(result) {
    if (!result) return null;
    if (result.__typename === 'TweetWithVisibilityResults' && result.tweet) {
      return result.tweet;
    }
    return result;
  }

  /** Pull a flat list of media URLs (photos + best-bitrate video) from legacy. */
  function extractMedia(legacy) {
    const media =
      safe(() => legacy.extended_entities.media, null) ||
      safe(() => legacy.entities.media, null) ||
      [];
    const urls = [];
    for (const m of media) {
      if (!m) continue;
      if (m.type === 'video' || m.type === 'animated_gif') {
        const variants = safe(() => m.video_info.variants, []) || [];
        const best = variants
          .filter((v) => v && v.content_type === 'video/mp4' && v.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        urls.push(best ? best.url : m.media_url_https);
      } else {
        // photo (and any unknown type) — fall back to the still image URL
        urls.push(m.media_url_https || m.media_url);
      }
    }
    return urls.filter(Boolean);
  }

  /** Normalize one tweet `result` object into the Xodus data model. */
  function normalizeTweet(result) {
    const tweet = unwrapTweet(result);
    if (!tweet) return null;

    const legacy = tweet.legacy || {};
    const userLegacy =
      safe(() => tweet.core.user_results.result.legacy, null) ||
      safe(() => tweet.core.user_results.result.core, null) ||
      {};

    const tweet_id = tweet.rest_id || legacy.id_str || '';
    if (!tweet_id) return null;

    const handle = userLegacy.screen_name || '';
    const name = userLegacy.name || '';
    const text = legacy.full_text || legacy.text || '';

    // A tweet is treated as part of a thread if X marks it with a self_thread
    // (i.e. the author replied to themselves). Heuristic — refine here if X
    // exposes a clearer signal.
    const is_thread = !!safe(() => legacy.self_thread.id_str, null);

    const quoted_tweet_url =
      safe(() => legacy.quoted_status_permalink.expanded, '') || '';

    return {
      tweet_id: tweet_id,
      url: handle
        ? `https://x.com/${handle}/status/${tweet_id}`
        : `https://x.com/i/web/status/${tweet_id}`,
      author_handle: handle,
      author_name: name,
      text: text,
      created_at: legacy.created_at || '',
      media_urls: extractMedia(legacy),
      is_thread: is_thread,
      quoted_tweet_url: quoted_tweet_url,
    };
  }

  /**
   * Parse a full GraphQL Bookmarks response (already JSON-parsed) into an array
   * of normalized bookmarks. Unknown/garbage entries are silently skipped.
   */
  function parseBookmarksResponse(json) {
    const instructions =
      safe(() => json.data.bookmark_timeline_v2.timeline.instructions, null) ||
      // Fallback: some variants nest under bookmark_timeline (v1). Try it too.
      safe(() => json.data.bookmark_timeline.timeline.instructions, null) ||
      [];

    const out = [];
    for (const instruction of instructions) {
      const entries = instruction && instruction.entries;
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const entryId = (entry && entry.entryId) || '';
        // Bookmark tweets have entryId "tweet-<id>"; "cursor-*" entries are
        // pagination markers we don't need (auto-scroll drives pagination).
        if (!entryId.startsWith('tweet-')) continue;
        const result = safe(
          () => entry.content.itemContent.tweet_results.result,
          null
        );
        const normalized = normalizeTweet(result);
        if (normalized) out.push(normalized);
      }
    }
    return out;
  }

  return {
    parseBookmarksResponse,
    normalizeTweet, // exported for unit testing / debugging
  };
})();
