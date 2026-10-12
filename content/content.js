// Puts a QuackPass button on Ryanair's booking pages.
//
// Preferred spot: right under Ryanair's own "Access boarding passes" button.
// Ryanair does not render that button in every state — a booking where only
// some passengers are checked in shows something else — so when it is missing,
// a small floating button appears in the corner instead. The checked-in
// passengers' passes exist either way, and must stay reachable.
//
// The site is a single-page app, so we keep watching for changes.

const BUTTON_ID = "quackpass-inline-button";
const FLOAT_ID = "quackpass-float";
const STYLE_ID = "quackpass-inline-style";
const HIDE_KEY = "quackpass-hide-float";

// Ryanair localises the label, so match on a phrase from each language.
const ANCHOR_PHRASES = [
  "boarding pass", // en
  "tarjetas de embarque", // es
  "carte d'imbarco", // it
  "cartes d'embarquement", // fr
  "bordkarten", // de
  "karty pokladowe", // pl (unaccented)
  "kart pok", // pl (accented, matched on the safe prefix)
  "cartoes de embarque", // pt (unaccented)
  "instapkaarten", // nl
];

const normalize = (text) => text.replace(/\s+/g, " ").trim().toLowerCase();

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${BUTTON_ID} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 10px 18px;
      border: 2px solid #073590;
      border-radius: 6px;
      background: #f1c933;
      color: #073590;
      font: 600 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      cursor: pointer;
    }
    #${BUTTON_ID}:hover { background: #ffd94a; }
    #${BUTTON_ID}:active { transform: translateY(1px); }

    #${FLOAT_ID} {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483000;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 4px 4px 0;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
    }
    #${FLOAT_ID} #${BUTTON_ID} { margin: 0; }
    #${FLOAT_ID} .quackpass-dismiss {
      order: -1;
      width: 24px;
      height: 24px;
      margin-left: 4px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: #666;
      font: 16px/1 system-ui, sans-serif;
      cursor: pointer;
    }
    #${FLOAT_ID} .quackpass-dismiss:hover { background: #eee; color: #000; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

// Ryanair's own button: short label, and it mentions boarding passes.
function isAnchor(element) {
  if (element.id === BUTTON_ID) return false;

  const label = normalize(element.textContent || "");
  if (!label || label.length > 60) return false;

  return ANCHOR_PHRASES.some((phrase) => label.includes(phrase));
}

function findAnchor() {
  for (const element of document.querySelectorAll("button, a, [role='button']")) {
    if (isAnchor(element)) return element;
  }
  return null;
}

// A page that talks about boarding passes is one where the button belongs,
// even when Ryanair's own button is not on it. The script only runs on
// ryanair.com, so this never fires anywhere else.
function pageMentionsPasses() {
  const text = normalize(document.body?.innerText || "");
  return ANCHOR_PHRASES.some((phrase) => text.includes(phrase));
}

function floatDismissed() {
  try {
    return sessionStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function buildButton(placement) {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.dataset.placement = placement;
  button.textContent = "🦆 No Smartphone? Click Here!";
  button.title = "Open your boarding passes with QuackPass";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: "QP_OPEN_PASSES" });
  });

  return button;
}

function placeInline(anchor) {
  // Sit under Ryanair's own button, inside the same block, so the layout holds.
  const host = anchor.parentElement || anchor;
  const wrapper = document.createElement("div");
  wrapper.appendChild(buildButton("inline"));
  host.insertBefore(wrapper, anchor.nextSibling);
}

function placeFloating() {
  const holder = document.createElement("div");
  holder.id = FLOAT_ID;

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "quackpass-dismiss";
  dismiss.textContent = "×";
  dismiss.title = "Hide for this visit";
  dismiss.addEventListener("click", () => {
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {}
    holder.remove();
  });

  holder.append(buildButton("floating"), dismiss);
  document.body.appendChild(holder);
}

function place() {
  const existing = document.getElementById(BUTTON_ID);
  const anchor = findAnchor();

  if (anchor) {
    if (existing?.dataset.placement === "inline") return;
    // Ryanair's button has appeared: swap the floating one for the inline one.
    document.getElementById(FLOAT_ID)?.remove();
    injectStyle();
    placeInline(anchor);
    return;
  }

  if (existing) return;
  if (floatDismissed() || !document.body || !pageMentionsPasses()) return;

  injectStyle();
  placeFloating();
}

let scheduled = false;

function schedulePlace() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    try {
      place();
    } catch (error) {
      console.error("QuackPass: could not place the button", error);
    }
  });
}

schedulePlace();
new MutationObserver(schedulePlace).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
