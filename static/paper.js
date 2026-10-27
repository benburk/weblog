/**
 * paper.js — the behaviour that comes with paper.css.
 *
 * Two things, both of which the apps were carrying a copy of: the
 * drawn caret, and the theme choice. An ES module, imported by the
 * app's own script (podium) or bundled into it (mdwriter).
 */

/* ---------------------------------------------------------------- *
 * The drawn caret
 *
 * A native caret is always one hairline in the text's own colour,
 * which is not enough to find in a page of monospace, and CSS cannot
 * thicken it. So it is a real element — one of them, owned by
 * whichever mount holds focus: a plain field, a wrapping textarea, or
 * an editor view the app measures itself.
 *
 * The stylesheet only hides the platform's caret once `drawn-caret` is
 * on the root, and that goes on the first time a mount takes the caret
 * — not when the module loads. An app that imports this for the theme
 * alone keeps the platform's caret, which is the right one for a
 * textarea: the browser offers no way to ask where a textarea's caret
 * is, so drawing one means re-laying the text in a mirror and hoping it
 * wraps the same, which zoom, a scrollbar, or a mobile keyboard can
 * each quietly break. A field with neither a ring nor a caret would be
 * worse than the ring the stylesheet takes away.
 * ---------------------------------------------------------------- */

const caretEl = document.createElement("div");
caretEl.className = "caret";
caretEl.hidden = true;
document.body.append(caretEl);

/** The fields whose caret is ours to draw. A password field is
 *  measured by its value and shows bullets, so its caret stays the
 *  platform's. */
export const TEXT_FIELD = "textarea, input:not([type=\"button\"], [type=\"checkbox\"], [type=\"color\"], "
  + "[type=\"file\"], [type=\"hidden\"], [type=\"password\"], [type=\"radio\"], "
  + "[type=\"range\"], [type=\"reset\"], [type=\"submit\"])";

// What to redraw when the page moves under the caret. `el` is the box
// the caret is trimmed to; `refresh` recomputes its position.
let owner = null;

export function hideCaret() {
  caretEl.hidden = true;
}

/** Hand the caret to a mount. `refresh` is called whenever the page
 *  moves under it — a scroll, a resize, a field growing as it is
 *  typed into. */
export function ownCaret(el, refresh) {
  owner = el ? { el, refresh } : null;
  if (el) document.documentElement.classList.add("drawn-caret");
}

/** Give the caret up, if this mount still has it. */
export function releaseCaret(el) {
  if (owner?.el === el) {
    owner = null;
    hideCaret();
  }
}

export function refreshCaret() {
  if (owner) owner.refresh();
}

// A focused field taken out of the page gets no `blur` in Safari or
// Firefox, so a re-render that drops the field would leave its caret
// blinking over whatever replaced it.
new MutationObserver(() => {
  if (owner && !owner.el.isConnected) {
    owner = null;
    hideCaret();
  }
}).observe(document.body, { childList: true, subtree: true });

/**
 * Put the caret at a point in viewport coordinates, trimmed to the
 * visible part of `clip` — the field or editor it belongs to.
 *
 * The caret is drawn outside the box it belongs to, because it has to
 * sit above a modal dialog, which means that box's own overflow
 * cannot clip it. A mount scrolled away from its caret would
 * otherwise leave the caret standing over whatever is above or below
 * it. A modal dialog paints in the top layer, above every z-index on
 * the page, so a caret left on the body would sit behind the dialog
 * holding the field; it goes in with the field instead.
 */
export function placeCaret(left, top, height, clip) {
  const edge = getComputedStyle(clip);
  const box = clip.getBoundingClientRect();
  const viewTop = box.top + parseFloat(edge.borderTopWidth);
  const viewBottom = box.bottom - parseFloat(edge.borderBottomWidth);
  const viewLeft = box.left + parseFloat(edge.borderLeftWidth);
  const viewRight = box.right - parseFloat(edge.borderRightWidth);
  const visibleTop = Math.max(top, viewTop);
  const visibleBottom = Math.min(top + height, viewBottom);
  if (
    visibleBottom - visibleTop < 1
    || left + 1.5 < viewLeft
    || left - 1.5 > viewRight
  ) {
    hideCaret();
    return;
  }

  const home = clip.closest("dialog") ?? document.body;
  if (caretEl.parentElement !== home) home.append(caretEl);
  caretEl.hidden = false;
  caretEl.style.left = `${left - 1.5}px`;
  caretEl.style.top = `${visibleTop}px`;
  caretEl.style.height = `${visibleBottom - visibleTop}px`;
  // Restart the blink so the caret is solid while it is being moved,
  // rather than vanishing mid-keystroke on whatever phase the loop
  // happened to be in.
  caretEl.style.animation = "none";
  void caretEl.offsetHeight;
  caretEl.style.animation = "";
}

// A wrapping textarea's caret cannot be measured as one run of text:
// the mirror re-lays everything before the caret under the same font
// and the same width, then reads a marker's position out of it.
const mirror = document.createElement("div");
mirror.style.cssText =
  "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word";
document.body.append(mirror);

const range = document.createRange();

// Where one character sits inside the mirror, relative to the mirror.
function charBox(index) {
  const text = mirror.firstChild;
  range.setStart(text, index);
  range.setEnd(text, index + 1);
  const box = range.getBoundingClientRect();
  const origin = mirror.getBoundingClientRect();
  return {
    left: box.left - origin.left,
    right: box.right - origin.left,
    top: box.top - origin.top,
  };
}

// A range over a character returns the box of its glyphs, which sits
// below the top of its line box by however much leading the face and
// the line height leave. That distance is measured once per pair
// rather than derived: it comes out of the face's own metrics, which
// CSS does not expose, and it is not simply half the difference.
const leadCache = new Map();

function lead(style) {
  const key = `${style.font}|${style.lineHeight}`;
  const cached = leadCache.get(key);
  if (cached !== undefined) return cached;
  const held = mirror.textContent;
  mirror.textContent = ".";
  const measured = charBox(0).top;
  mirror.textContent = held;
  leadCache.set(key, measured);
  return measured;
}

function mirrorCaret(field, head, style) {
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.tabSize = style.tabSize;
  // The fractional content width. `clientWidth` rounds down, and a
  // mirror even a pixel narrow wraps one character early where the
  // text exactly fits, throwing the caret onto the next line a
  // keystroke before the field does.
  //
  // A vertical scrollbar is inside the bounding box and outside
  // `clientWidth`, and a field long enough to scroll grows one. The
  // width it takes is whole pixels, so taking it off the fractional
  // box width leaves the fraction intact. Without this the mirror is
  // ten pixels wide of the text the field is laying out, wraps two
  // columns late, and parks the caret at the right-hand end of a line
  // the field has already moved on from.
  const box = field.getBoundingClientRect();
  const frame = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  const scrollbar = Math.round(box.width - frame - field.clientWidth);
  mirror.style.width = `${
    box.width
    - frame
    - scrollbar
    - parseFloat(style.paddingLeft)
    - parseFloat(style.paddingRight)
  }px`;
  // The caret stands where the character after it stands, so that
  // character is what gets measured — a range over it, rather than a
  // marker element placed beside it. A marker has to be asked for its
  // `offsetLeft`, and engines do not agree what that means for an
  // inline box broken across lines: Blink answers with the first
  // fragment, WebKit with the union of them, and the union is the
  // left edge of a wrapped paragraph rather than the caret. A range
  // is answered the same way everywhere.
  //
  // A full stop is added only at the end of the value, where there is
  // no next character to range over, and where a trailing newline
  // needs something on the line it opened. Anywhere else the text is
  // left exactly as the field holds it, so nothing can wrap
  // differently here than it does there.
  mirror.textContent = head < field.value.length ? field.value : `${field.value}.`;
  const at = charBox(head);
  // A space that falls at a soft wrap hangs past the end of the line
  // it closes, and the field leaves the caret hanging with it rather
  // than moving it to the line below. The character after the caret
  // has already moved, so it answers the wrong question here; the
  // space itself answers the right one. A wrap that falls mid-word
  // has no such space, and the caret does move down.
  if (head > 0 && field.value[head - 1] === " ") {
    const space = charBox(head - 1);
    if (space.top < at.top) {
      return { left: space.right, top: space.top - lead(style) };
    }
  }
  return { left: at.left, top: at.top - lead(style) };
}

// The house face is monospace, so a single line's caret is just the
// width of the text before it.
let rulerCanvas = null;
const ruler = () => {
  rulerCanvas ??= document.createElement("canvas").getContext("2d");
  return rulerCanvas;
};

const fieldHead = (field) =>
  field.selectionDirection === "backward"
    ? field.selectionStart
    : field.selectionEnd;

/**
 * Whether a textarea's caret sits on its last soft-wrapped line — the
 * moment ArrowDown should leave the field rather than move within it.
 */
export function caretOnLastLine(field) {
  const style = getComputedStyle(field);
  const head = fieldHead(field) ?? field.value.length;
  const at = mirrorCaret(field, head, style).top;
  const last = mirrorCaret(field, field.value.length, style).top;
  return at >= last;
}

/** Draw the caret for a plain field, and take ownership of it. */
export function drawFieldCaret(field) {
  ownCaret(field, () => drawFieldCaret(field));
  const head = fieldHead(field);
  if (
    document.activeElement !== field
    || !field.isConnected
    || head === null
    // A range has two ends and no caret between them.
    || field.selectionStart !== field.selectionEnd
  ) {
    hideCaret();
    return;
  }
  const style = getComputedStyle(field);
  const box = field.getBoundingClientRect();
  const height = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6;
  const left = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
  if (field instanceof HTMLTextAreaElement) {
    const at = mirrorCaret(field, head, style);
    placeCaret(
      left + at.left - field.scrollLeft,
      box.top
        + parseFloat(style.borderTopWidth)
        + parseFloat(style.paddingTop)
        + at.top
        - field.scrollTop,
      height,
      field,
    );
    return;
  }
  const pen = ruler();
  pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  placeCaret(
    left + pen.measureText(field.value.slice(0, head)).width
      - field.scrollLeft,
    // A single-line field centres its one line in whatever height it
    // has.
    box.top + (box.height - height) / 2,
    height,
    field,
  );
}

// Arrow keys and clicks move a field's selection without an input
// event. `selectionchange` is the one signal that covers them all, but
// browsers have only recently fired it for fields, so `keyup` and
// `mouseup` stay as the fallback. One listener serves every attached
// field rather than one per field.
const attached = new WeakSet();
let watchingSelection = false;

/** Draw the caret for one field whenever it holds focus. Use this
 *  where the app wants to say which fields take a drawn caret. */
export function attachFieldCaret(field) {
  attached.add(field);
  if (!watchingSelection) {
    watchingSelection = true;
    document.addEventListener("selectionchange", () => {
      const active = document.activeElement;
      if (attached.has(active)) drawFieldCaret(active);
    });
  }
  const update = () => drawFieldCaret(field);
  field.addEventListener("focus", update);
  field.addEventListener("input", update);
  field.addEventListener("keyup", update);
  field.addEventListener("mouseup", update);
  field.addEventListener("blur", () => releaseCaret(field));
  // A field can already hold focus by the time it is attached, and no
  // second `focus` will ever arrive for it.
  if (document.activeElement === field) update();
}

/** Draw the caret in every text field on the page, including ones
 *  added later. Use this where every field means it. */
export function watchFields(selector = TEXT_FIELD) {
  document.addEventListener("focusin", (event) => {
    const field = event.target.closest?.(selector);
    if (field) drawFieldCaret(field);
    else {
      owner = null;
      hideCaret();
    }
  });

  document.addEventListener("focusout", () => {
    owner = null;
    hideCaret();
  });

  // `selectionchange` covers arrows, Home/End and click placement in
  // one signal, but browsers have only recently fired it for fields;
  // `input` and `keyup` cover the rest.
  for (const signal of ["selectionchange", "input", "keyup"]) {
    document.addEventListener(signal, refreshCaret, true);
  }

  // A field carrying `autofocus` can already hold focus by the time
  // this module runs, and no `focusin` will ever arrive for it.
  // Whoever is focused now is the owner.
  const focused = document.activeElement?.closest?.(selector);
  if (focused) drawFieldCaret(focused);
}

// A mount can move without anything moving inside it: a transcript
// scrolls under the composer, a composer grows as you type, a window
// resizes, an inner pane scrolls.
document.addEventListener("scroll", refreshCaret, true);
window.addEventListener("resize", refreshCaret);

/* ---------------------------------------------------------------- *
 * The theme choice
 *
 * system, light, or dark. An explicit choice sets data-theme on the
 * root element, which paper.css honours over the OS preference by
 * pinning `color-scheme`; "system" removes it. A pre-paint script in
 * the document applies the stored choice before first render so there
 * is no flash, which is why the key is a caller's to pass: that
 * snippet is inline, and this module loads too late to be it.
 * ---------------------------------------------------------------- */

export const THEMES = ["system", "light", "dark"];

/** The persisted choice; unreadable storage reads as system. */
export function themeChoice(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // Fall through.
  }
  return "system";
}

export function setTheme(key, theme) {
  if (theme === "system") delete document.documentElement.dataset["theme"];
  else document.documentElement.dataset["theme"] = theme;
  try {
    localStorage.setItem(key, theme);
  } catch {
    // The choice still applies for this session.
  }
}

/** The next choice in the cycle, applied and stored. */
export function cycleTheme(key) {
  const next = THEMES[(THEMES.indexOf(themeChoice(key)) + 1) % THEMES.length];
  setTheme(key, next);
  return next;
}
