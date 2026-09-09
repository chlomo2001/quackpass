// Injects a QuackPass button next to Ryanair's "Access boarding passes" button.
// The site is a single-page app, so we keep watching for the anchor to reappear.

const BUTTON_ID = "quackpass-inline-button";
const STYLE_ID = "quackpass-inline-style";

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

function buildButton() {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = "🦆 No Smartphone? Click Here!";
  button.title = "Open your boarding passes with QuackPass";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: "QP_OPEN_PASSES" });
  });

  return button;
}

function place() {
  if (document.getElementById(BUTTON_ID)) return;

  const anchor = findAnchor();
  if (!anchor) return;

  injectStyle();

  // Sit under Ryanair's own button, inside the same block, so the layout holds.
  const host = anchor.parentElement || anchor;
  const wrapper = document.createElement("div");
  wrapper.appendChild(buildButton());
  host.insertBefore(wrapper, anchor.nextSibling);
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
