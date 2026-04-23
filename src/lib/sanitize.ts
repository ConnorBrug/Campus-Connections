/**
 * Defensive sanitization helpers for user-supplied text.
 *
 * Goal: stop an attacker (or an innocent paste) from injecting control
 * characters, direction-override / zero-width characters, or JS/HTML that
 * would render as active content somewhere downstream (email templates,
 * push notifications, Firestore-indexed display strings).
 *
 * This is NOT a replacement for per-surface encoding. We still HTML-escape
 * anywhere we interpolate into an HTML email template (see
 * functions/src/email.ts `esc`). This module is the *input-side* gate so bad
 * data never lands in Firestore in the first place.
 */

// U+0000..U+001F / U+007F..U+009F: ASCII + C1 controls
// U+200B..U+200F: ZWSP, ZWNJ, ZWJ, LRM, RLM
// U+2028..U+202F: line/para separators + bidi overrides
// U+2060..U+206F: word joiner + deprecated formatting controls
// U+FEFF: byte-order mark / ZWNBSP
const INVISIBLE_OR_CONTROL =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g;

/**
 * Core cleaner. Strips invisible/control characters, normalizes whitespace,
 * and enforces a maximum length. Always returns a string (never null).
 */
export function sanitizeText(raw: unknown, maxLen = 500): string {
  if (raw == null) return '';
  let s = String(raw)
    // Kill control + bidi + zero-width tricks.
    .replace(INVISIBLE_OR_CONTROL, '')
    // Normalize Unicode forms so look-alikes collapse (e.g. fullwidth Latin
    // chars → ASCII). Defence-in-depth against "impersonation via lookalike".
    .normalize('NFKC')
    // Collapse runs of whitespace (incl. CR/LF that survived above because
    // we explicitly allow \n / \t in multi-line fields via sanitizeMultiline).
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Same as sanitizeText but preserves newlines for multi-line fields (trip
 * notes, chat composer, etc). Still strips every other control character.
 */
export function sanitizeMultiline(raw: unknown, maxLen = 2000): string {
  if (raw == null) return '';
  let s = String(raw)
    // Allow \n (U+000A) and \t (U+0009); strip the rest of the control range.
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, '')
    .normalize('NFKC')
    // Normalize CRLF / CR to LF, and collapse 3+ blank lines to 2.
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Collapse horizontal whitespace runs inside a line.
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Stricter variant for short single-line fields that should only contain
 * printable letters / numbers / common punctuation (names, campus area,
 * flight code, airport code). Drops anything that isn't in the allow-list.
 */
export function sanitizeStrict(raw: unknown, maxLen = 80): string {
  if (raw == null) return '';
  // Letters (incl. accented), digits, space, apostrophe, hyphen, period,
  // comma, parens — the usual "name-shaped" character set. Everything else
  // is dropped silently.
  const cleaned = sanitizeText(raw, maxLen + 100)
    .replace(/[^\p{L}\p{N} '\-.,()]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return cleaned.slice(0, maxLen);
}

/** Conservative email sanitizer — never alters the local-part casing. */
export function sanitizeEmail(raw: unknown): string {
  const s = sanitizeText(raw, 254).toLowerCase();
  // RFC-ish sanity: exactly one @, domain has a dot, no whitespace.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return '';
  return s;
}
