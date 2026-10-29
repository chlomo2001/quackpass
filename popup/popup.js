import { downloadPass, fetchGoogleWalletToken } from "../lib/api.js";
import { buildZip } from "../lib/zip.js";
import { buildPdf, encodePdfPage } from "../lib/pdf.js";
import { airportName, destinationCountry } from "../lib/airports.js";
import { hebrewDate } from "../lib/hebrew.js";
import { isInfant } from "../lib/ryanair.js";
import { CACHE_TTL_MS, GOOGLE_WALLET_SAVE_URL } from "../lib/config.js";

const statusEl = document.getElementById("status");
const passesEl = document.getElementById("passes");
const bulkActionsEl = document.getElementById("bulk-actions");
const searchBarEl = document.getElementById("search-bar");

const SEARCH_MIN_PASSES = 4;
const READY_QUACK = "Ready to quack...";
const QUACKS = ["Quack!", "Quack quack! 🦆", "Top quack! 🦆", "Mighty quack!", "Splash! 🦆"];

// bwip-js expects these arbitrary-precision helpers on the global object.
if (typeof self.bcadd !== "function") {
  const big = (v) => BigInt(String(v));
  self.bcadd = (a, b) => String(big(a) + big(b));
  self.bcmul = (a, b) => String(big(a) * big(b));
  self.bcdiv = (a, b) => String(big(a) / big(b));
}

const setStatus = (text) => { statusEl.textContent = text; };
const randomQuack = () => QUACKS[Math.floor(Math.random() * QUACKS.length)];

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

const formatTime = (value) =>
  new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function drawAztec(canvas, text, scale) {
  self.bwipjs.toCanvas(canvas, {
    bcid: "azteccode",
    text,
    scale,
    backgroundcolor: "ffffff",
    includetext: false,
  });
}

// ---------------------------------------------------------------- file names

const clean = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

function passBaseName(pass) {
  return `${clean(pass.name.first)}_${clean(pass.name.last)}_${clean(pass.seat?.designator)}`;
}

const passFilename = (pass, ext) => `${passBaseName(pass)}.${ext}`;

// ------------------------------------------------------------ flight timing

// Ryanair closes the gate 30 minutes before the departure time printed on the
// ticket, and can refuse boarding from that moment. Always work from the
// ticket's own departure time — never from anything else.
const GATE_CLOSES_MINUTES = 30;

// A date-only value would render as 00:00, so only accept a real timestamp.
function timestamp(value) {
  if (typeof value !== "string" || !/T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function departureTime(pass) {
  return timestamp(pass.departure?.dateTime) ?? timestamp(pass.departure?.date);
}

// Arrival times come from the bookings response, keyed by booking + flight.
let arrivalIndex = new Map();

const flightKey = (pnr, flightNumber) =>
  `${String(pnr ?? "").toUpperCase()}|${String(flightNumber ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")}`;

function indexArrivals(flights) {
  arrivalIndex = new Map();
  for (const flight of flights ?? []) {
    if (flight.arrivalDate) {
      arrivalIndex.set(flightKey(flight.pnr, flight.flightNumber), flight.arrivalDate);
    }
  }
}

function arrivalTime(pass) {
  const direct = timestamp(pass.arrival?.dateTime) ?? timestamp(pass.arrival?.date);
  if (direct) return direct;

  const key = flightKey(pass.pnr, `${pass.flight?.carrierCode}${pass.flight?.number}`);
  return timestamp(arrivalIndex.get(key));
}

// "Manchester ✈ Brussels Charleroi" when both airports are known.
function routeNames(pass) {
  const from = airportName(pass.departure?.code);
  const to = airportName(pass.arrival?.code);
  return from && to ? `${from} ✈ ${to}` : null;
}

function gateCloseTime(pass) {
  const departs = departureTime(pass);
  if (!departs) return null;

  return new Date(departs.getTime() - GATE_CLOSES_MINUTES * 60000);
}

const GATE_HINT = `Gate closes ${GATE_CLOSES_MINUTES} minutes before departure.`;

// Terminals only exist at some airports, so this is shown where applicable.
function terminalOf(pass) {
  const raw =
    pass.departure?.terminal ??
    pass.departure?.terminalName ??
    pass.departureTerminal ??
    null;

  if (raw === null || raw === undefined) return null;

  const text = String(raw).trim();
  if (!text) return null;

  return /terminal/i.test(text) ? text : `Terminal ${text}`;
}

// Ryanair's Fast Track add-on. The API field is not documented, so accept the
// likely shapes: a boolean flag, or the add-on's name or code ("FAST"/"FTRK")
// inside any extras list. The barcode is skipped — it is fixed-format data,
// not a feature list — and a bare "fast" is never enough: "Belfast" has one.
function hasFastTrack(pass) {
  if (pass.fastTrack === true || pass.isFastTrack === true || pass.fasttrack === true) {
    return true;
  }
  if (pass.fastTrack === false || pass.isFastTrack === false) return false;

  // Only string values count — never key names, or "fastTrack": false would match.
  const values = [];
  const walk = (value, key) => {
    if (key === "barcode") return;
    if (typeof value === "string") values.push(value.trim());
    else if (Array.isArray(value)) value.forEach((item) => walk(item, key));
    else if (value && typeof value === "object") {
      for (const [k, item] of Object.entries(value)) walk(item, k);
    }
  };
  walk(pass, "");

  return values.some((text) => /fast[\s_-]*track/i.test(text) || /^(FAST|FTRK)$/.test(text));
}

// Checked (hold) bags. The API field is not documented, so accept the likely
// shapes: a plain count, or bag items in any extras list with a code such as
// "BBG" / "BAG" / "B20K" or a name such as "20kg Check-in Bag". Cabin and
// priority bags are not hold luggage and are skipped. Returns "2 × 20 kg", "1 bag", or
// null when there is nothing to show.
const CABIN_BAG = /cabin|hand\s*bag|carry|CBAG|priority/i;
// Ryanair's bookings API uses "BBG" for a check-in bag (seen on real
// bookings); BAG, BAG20 and B20K are accepted in case other shapes turn up.
const BAG_CODE = /^(BBG|BAG\d*|B\d{2}K?)$/i;
const BAG_WORDS = /check(ed|-?in)?\s*(in\s*)?bag|hold\s*bag|luggage|baggage/i;

function checkedBagsLabel(pass) {
  const format = (count, weights) => {
    if (count <= 0) return null;
    const same = weights.length === count && weights.every((w) => w === weights[0]);
    if (same) return `${count} × ${weights[0]} kg`;
    return `${count} bag${count === 1 ? "" : "s"}`;
  };

  for (const key of ["checkedBags", "checkedInBags", "holdBags", "bags", "baggage", "numberOfBags", "bagCount"]) {
    if (typeof pass[key] === "number") return format(pass[key], []);
  }

  // Extras copied from the bookings response (see lib/ryanair.js). Ryanair
  // lists one SSR entry per bag, so count entries and nothing inside them:
  // an entry can repeat its own code per segment, which double-counted before.
  if (Array.isArray(pass.extras)) {
    const bags = pass.extras.filter((s) => s && BAG_CODE.test(String(s.code ?? "")));
    const weights = bags.map((s) => (typeof s.weight === "number" ? s.weight : null)).filter(Boolean);
    return format(bags.length, weights);
  }

  let count = 0;
  const weights = [];

  const weightOf = (text, item) => {
    if (item && typeof item.weight === "number") return item.weight;
    const match = /(\d{2})\s*kg/i.exec(text) ?? /\bB(\d{2})K\b/i.exec(text);
    return match ? Number(match[1]) : null;
  };

  const consider = (text, item) => {
    const flat = text.replace(/\s+/g, " ").trim();
    if (!flat || CABIN_BAG.test(flat)) return;
    const words = flat.split(" ");
    if (!(words.some((w) => BAG_CODE.test(w)) || BAG_WORDS.test(flat))) return;
    const qty = item && typeof item.quantity === "number" ? item.quantity
      : item && typeof item.count === "number" ? item.count : 1;
    const weight = weightOf(flat, item);
    count += qty;
    for (let i = 0; i < qty; i++) if (weight) weights.push(weight);
  };

  const walk = (value, key) => {
    if (key === "barcode") return;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") consider(item, null);
        else if (item && typeof item === "object") {
          const text = Object.values(item).filter((v) => typeof v === "string").join(" ");
          consider(text, item);
          for (const [k, v] of Object.entries(item)) if (Array.isArray(v)) walk(v, k);
        }
      }
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  walk(pass, "");

  return format(count, weights);
}

// ---------------------------------------------------------- missing barcode

// Ryanair sometimes returns a pass with no barcode. The API never says why, so
// the notice describes what is missing and only suggests the usual cause.
const hasBarcode = (pass) => typeof pass.barcode === "string" && pass.barcode.trim() !== "";

const NOTICE_TITLE = "No barcode on this pass";

function missingBarcodeNotice(pass) {
  return {
    tone: "warning",
    icon: "⚠",
    title: NOTICE_TITLE,
    lines: [
      "Ryanair returned this boarding pass without a scannable barcode.",
      `This can happen when entry documents for ${destinationCountry(pass)} have ` +
        `not yet been checked or linked to the booking.`,
      "Please check your booking with Ryanair, and carry the documents that prove " +
        "your right of entry.",
    ],
  };
}

// ---------------------------------------------------------- shared barcodes

// Ryanair can return the same barcode on two passes — an infant travelling on
// an adult's lap gets the adult's barcode, with the adult's name inside it.
// Printing it again under the infant's name would scan as the adult at the
// gate, so only the real holder's card shows it.

const onlyLetters = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z]/g, "");

// IATA boarding pass data carries "LAST/FIRST" in characters 3 to 22.
function barcodeHolder(pass) {
  const code = pass.barcode;
  if (typeof code !== "string" || code[0] !== "M" || code.length < 22) return null;
  const [last = "", first = ""] = code.slice(2, 22).trim().split("/");
  return { last: onlyLetters(last), first: onlyLetters(first) };
}

// The name field is cut at 20 characters and can carry a title, so compare prefixes.
const samePrefix = (a, b) => Boolean(a && b) && (a.startsWith(b) || b.startsWith(a));

function holdsOwnBarcode(pass) {
  const holder = barcodeHolder(pass);
  if (!holder) return false;
  return (
    samePrefix(holder.last, onlyLetters(pass.name?.last)) &&
    (!holder.first || samePrefix(holder.first, onlyLetters(pass.name?.first)))
  );
}

let barcodeOwner = new Map(); // pass -> the pass whose barcode it carries
let sharersOf = new Map(); // owner pass -> passes that carry its barcode

function indexSharedBarcodes(passes) {
  barcodeOwner = new Map();
  sharersOf = new Map();

  const byCode = new Map();
  for (const pass of passes) {
    if (!hasBarcode(pass)) continue;
    if (!byCode.has(pass.barcode)) byCode.set(pass.barcode, []);
    byCode.get(pass.barcode).push(pass);
  }

  for (const group of byCode.values()) {
    if (group.length < 2) continue;

    const owner =
      group.find(holdsOwnBarcode) ?? group.find((p) => !isInfant(p.paxType)) ?? group[0];

    for (const pass of group) {
      if (pass === owner) continue;
      barcodeOwner.set(pass, owner);
      if (!sharersOf.has(owner)) sharersOf.set(owner, []);
      sharersOf.get(owner).push(pass);
    }
  }
}

const fullName = (pass) => `${pass.name.first} ${pass.name.last}`;

const alsoCovers = (pass) => {
  const sharers = sharersOf.get(pass);
  return sharers ? `Also covers ${sharers.map(fullName).join(", ")}` : null;
};

function sharedBarcodeNotice(pass, owner) {
  return {
    tone: "info",
    icon: "👶",
    title: "On another passenger's pass",
    lines: [
      `Ryanair issued one barcode for ${fullName(owner)} and ${fullName(pass)} on this flight.`,
      `At the gate, use ${fullName(owner)}'s boarding pass.`,
    ],
  };
}

// ------------------------------------------------------------- ticket canvas

const CARD_W = 500; // logical size the card layout is designed at
const CARD_H = 740;
const CARD_RATIO = CARD_H / CARD_W;

// Draws one boarding pass card into ctx at (x, y), scaled to `width` pixels.
function drawTicketCard(ctx, pass, x, y, width) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / CARD_W, width / CARD_W);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${pass.departure.code} ✈ ${pass.arrival.code}`, CARD_W / 2, 48);

  const names = routeNames(pass);
  if (names) {
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#555555";
    ctx.fillText(names, CARD_W / 2, 70);
  }

  ctx.strokeStyle = "#eeeeee";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 86);
  ctx.lineTo(CARD_W - 40, 86);
  ctx.stroke();

  const field = (label, value, fx, fy, align = "left") => {
    ctx.textAlign = align;
    ctx.font = "normal 14px sans-serif";
    ctx.fillStyle = "#666666";
    ctx.fillText(label.toUpperCase(), fx, fy);
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#000000";
    ctx.fillText(value, fx, fy + 25);
  };

  field("Passenger", `${pass.name.first} ${pass.name.last}`, 40, 114);
  field("Booking ref", pass.pnr, CARD_W - 40, 114, "right");

  const covers = alsoCovers(pass);
  if (covers) {
    ctx.textAlign = "left";
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#073590";
    ctx.fillText(covers, 40, 155);
  }
  field("Flight", `${pass.flight.carrierCode} ${pass.flight.number}`, 40, 172);
  field("Date", formatDate(pass.departure.date), CARD_W - 40, 172, "right");

  const hebrew = hebrewDate(pass.departure.date);
  if (hebrew) {
    // Canvas reorders Hebrew wrongly unless the direction is set explicitly.
    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#666666";
    ctx.fillText(hebrew, CARD_W - 40, 215);
    ctx.restore();
  }

  field("Seat", pass.seat.designator, 40, 244);
  const bags = checkedBagsLabel(pass);
  if (bags) field("Bags", bags, CARD_W / 2, 244, "center");
  field("Seq", String(pass.sequence), CARD_W - 40, 244, "right");

  const gate = gateCloseTime(pass);
  const departs = departureTime(pass);
  const arrives = arrivalTime(pass);

  if (gate) field("Gate closes", formatTime(gate), 40, 302);
  if (departs) field("Departs", formatTime(departs), CARD_W / 2, 302, "center");
  if (arrives) field("Arrives", formatTime(arrives), CARD_W - 40, 302, "right");

  const terminal = terminalOf(pass);
  if (terminal) {
    ctx.textAlign = "left";
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#333333";
    ctx.fillText(terminal, 40, 352);
  }

  const badges = [];
  if (hasFastTrack(pass)) badges.push("FAST TRACK 🚀");
  if (pass.priority) badges.push("PRIORITY BOARDING ⚡");
  if (badges.length) {
    ctx.textAlign = "right";
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#073590";
    ctx.fillText(badges.join("  ·  "), CARD_W - 40, 352);
  }

  const owner = barcodeOwner.get(pass);

  if (owner) {
    drawNotice(ctx, sharedBarcodeNotice(pass, owner));
  } else if (hasBarcode(pass)) {
    try {
      const aztec = document.createElement("canvas");
      drawAztec(aztec, pass.barcode, 8); // oversampled so it stays sharp when printed
      const size = 258;
      ctx.drawImage(aztec, (CARD_W - size) / 2, 368, size, size);
    } catch (error) {
      console.error("Failed to draw Aztec code", error);
    }
  } else {
    drawNotice(ctx, missingBarcodeNotice(pass));
  }

  if (gate) {
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#666666";
    ctx.textAlign = "center";
    ctx.fillText(GATE_HINT, CARD_W / 2, CARD_H - 56);
  }

  ctx.font = "italic 14px sans-serif";
  ctx.fillStyle = "#999999";
  ctx.textAlign = "center";
  ctx.fillText(`${pass.pnr} · generated with QuackPass 🦆`, CARD_W / 2, CARD_H - 30);

  ctx.restore();
}

// Greedy word wrap, in the ctx's current font.
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";

  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

const NOTICE_COLOURS = {
  warning: { fill: "#fff8e6", stroke: "#c8890a", icon: "#c8890a", title: "#6b4a00", text: "#3d3222" },
  info: { fill: "#eef3ff", stroke: "#073590", icon: "#073590", title: "#073590", text: "#1d2b4a" },
};

// Printed where the barcode would have been, so the gap is never a mystery.
function drawNotice(ctx, notice) {
  const left = 30;
  const top = 368;
  const boxW = CARD_W - left * 2;
  const boxH = 258;
  const pad = 18;
  const colours = NOTICE_COLOURS[notice.tone];

  ctx.save();

  ctx.fillStyle = colours.fill;
  ctx.strokeStyle = colours.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(left, top, boxW, boxH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";

  ctx.font = "26px sans-serif";
  ctx.fillStyle = colours.icon;
  ctx.fillText(notice.icon, CARD_W / 2, top + pad + 22);

  ctx.font = "bold 19px sans-serif";
  ctx.fillStyle = colours.title;
  ctx.fillText(notice.title.toUpperCase(), CARD_W / 2, top + pad + 58);

  ctx.font = "15px sans-serif";
  ctx.fillStyle = colours.text;

  let y = top + pad + 92;
  for (const paragraph of notice.lines) {
    for (const line of wrapText(ctx, paragraph, boxW - pad * 2)) {
      ctx.fillText(line, CARD_W / 2, y);
      y += 21;
    }
    y += 6;
  }

  ctx.restore();
}

// Wallet-size PNG of a single pass: 500 x 740 at 3x.
function drawTicketToCanvas(pass) {
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * scale;
  canvas.height = CARD_H * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not supported");
  ctx.scale(scale, scale);

  drawTicketCard(ctx, pass, 0, 0, CARD_W);
  return canvas;
}

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png")
  );

async function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename, saveAs: false });
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// -------------------------------------------------------------- A4 printing

const A4_MM = { w: 210, h: 297 };
const A4_MARGIN_MM = 10;
const A4_GAP_MM = 6;
const WALLET_W_MM = 64; // a boarding pass card that fits a wallet
const MIN_CARD_W_MM = 45; // below this the Aztec code gets hard to scan
const PRINT_DPI = 200;

const mmToPx = (mm) => Math.round((mm / 25.4) * PRINT_DPI);

// Biggest card width (mm, never above wallet size) that fits `count` cards on one page.
function fitOnePage(count) {
  const usableW = A4_MM.w - 2 * A4_MARGIN_MM;
  const usableH = A4_MM.h - 2 * A4_MARGIN_MM;
  let best = null;

  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const byWidth = (usableW - (cols - 1) * A4_GAP_MM) / cols;
    const byHeight = (usableH - (rows - 1) * A4_GAP_MM) / rows / CARD_RATIO;
    const cardW = Math.min(byWidth, byHeight, WALLET_W_MM);

    if (cardW > 0 && (!best || cardW > best.cardW)) best = { cols, rows, cardW };
  }

  return best;
}

// Fallback grid when a booking has too many passengers to stay readable on one page.
function walletGrid() {
  const usableW = A4_MM.w - 2 * A4_MARGIN_MM;
  const usableH = A4_MM.h - 2 * A4_MARGIN_MM;
  return {
    cols: Math.max(1, Math.floor((usableW + A4_GAP_MM) / (WALLET_W_MM + A4_GAP_MM))),
    rows: Math.max(
      1,
      Math.floor((usableH + A4_GAP_MM) / (WALLET_W_MM * CARD_RATIO + A4_GAP_MM))
    ),
    cardW: WALLET_W_MM,
  };
}

function drawA4Page(group, grid) {
  const canvas = document.createElement("canvas");
  canvas.width = mmToPx(A4_MM.w);
  canvas.height = mmToPx(A4_MM.h);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not supported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cardH = grid.cardW * CARD_RATIO;
  const blockW = grid.cols * grid.cardW + (grid.cols - 1) * A4_GAP_MM;
  const originX = (A4_MM.w - blockW) / 2;

  group.forEach((pass, i) => {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const x = mmToPx(originX + col * (grid.cardW + A4_GAP_MM));
    const y = mmToPx(A4_MARGIN_MM + row * (cardH + A4_GAP_MM));
    const w = mmToPx(grid.cardW);
    const h = mmToPx(cardH);

    drawTicketCard(ctx, pass, x, y, w);

    // Dashed guide so the cards can be cut out to wallet size.
    ctx.save();
    ctx.strokeStyle = "#bbbbbb";
    ctx.lineWidth = Math.max(1, mmToPx(0.25));
    ctx.setLineDash([mmToPx(2), mmToPx(2)]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  });

  return canvas;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function groupByBooking(passes) {
  const groups = new Map();
  for (const pass of passes) {
    if (!groups.has(pass.pnr)) groups.set(pass.pnr, []);
    groups.get(pass.pnr).push(pass);
  }
  return [...groups.values()];
}

// mode "sheet": every ticket of a booking together. mode "single": one per page.
function buildA4Canvases(passes, mode) {
  if (mode === "single") {
    return passes.map((pass) =>
      drawA4Page([pass], { cols: 1, rows: 1, cardW: WALLET_W_MM })
    );
  }

  return groupByBooking(passes).flatMap((group) => {
    const fit = fitOnePage(group.length);
    if (fit && fit.cardW >= MIN_CARD_W_MM) return [drawA4Page(group, fit)];

    const grid = walletGrid();
    return chunk(group, grid.cols * grid.rows).map((part) => drawA4Page(part, grid));
  });
}

async function saveA4Pdf(passes, mode, filename) {
  const canvases = buildA4Canvases(passes, mode);

  const pages = [];
  for (const canvas of canvases) {
    pages.push(await encodePdfPage(canvas));
  }

  await saveBlob(new Blob([buildPdf(pages)], { type: "application/pdf" }), filename);
  return canvases.length;
}

// ------------------------------------------------------------ ticket detail

// [left label, left value, right label, right value] — a blank right label
// leaves that half of the row empty.
// Rows of [leftCell, rightCell]; a null right cell leaves that half empty.
// A cell is {label, value} plus an optional {sub} line underneath.
function ticketRows(pass) {
  const gate = gateCloseTime(pass);
  const departs = departureTime(pass);
  const arrives = arrivalTime(pass);
  const terminal = terminalOf(pass);
  const priority = { label: "Priority", value: pass.priority ? "YES ⚡" : "No" };

  const rows = [
    [
      { label: "Passenger", value: `${pass.name.first} ${pass.name.last}`, sub: alsoCovers(pass) },
      { label: "Booking ref", value: pass.pnr },
    ],
    [
      { label: "Flight", value: `${pass.flight.carrierCode} ${pass.flight.number}` },
      {
        label: "Date",
        value: formatDate(pass.departure.date),
        sub: hebrewDate(pass.departure.date),
      },
    ],
    [
      { label: "Seat", value: pass.seat.designator },
      { label: "Seq", value: String(pass.sequence) },
    ],
  ];

  const times = [];
  if (gate) times.push({ label: "Gate closes", value: formatTime(gate) });
  if (departs) times.push({ label: "Departs", value: formatTime(departs) });
  if (arrives) times.push({ label: "Arrives", value: formatTime(arrives) });
  if (terminal) times.push({ label: "Terminal", value: terminal });
  const bags = checkedBagsLabel(pass);
  if (bags) times.push({ label: "Checked bags", value: bags });
  if (hasFastTrack(pass)) times.push({ label: "Fast Track", value: "YES 🚀" });
  times.push(priority);

  for (let i = 0; i < times.length; i += 2) {
    rows.push([times[i], times[i + 1] ?? null]);
  }

  return rows;
}

function ticketCell(cell, align) {
  const wrapper = document.createElement("div");
  if (align === "right") wrapper.style.textAlign = "right";

  const labelEl = document.createElement("div");
  labelEl.className = "ticket-label";
  labelEl.textContent = cell.label;

  const valueEl = document.createElement("div");
  valueEl.className = "ticket-value";
  valueEl.textContent = cell.value;

  wrapper.append(labelEl, valueEl);

  if (cell.sub) {
    const subEl = document.createElement("div");
    subEl.className = "ticket-sub";
    subEl.textContent = cell.sub;
    wrapper.appendChild(subEl);
  }

  return wrapper;
}

function renderTicketDetails(container, pass) {
  container.innerHTML = `
    <div class="ticket-actions">
      <button data-export="copy">Copy Image</button>
      <button data-export="wallet" title="PNG at wallet size">Save Wallet PNG</button>
      <button data-export="a4" title="A4 page with one wallet-size ticket">Save A4 PDF</button>
    </div>
    <div class="ticket-detail">
      <div class="ticket-route"></div>
    </div>
    <div class="aztec-canvas"></div>
  `;

  const detail = container.querySelector(".ticket-detail");
  container.querySelector(".ticket-route").textContent =
    `${pass.departure.code} ✈ ${pass.arrival.code}`;

  const names = routeNames(pass);
  if (names) {
    const namesEl = document.createElement("div");
    namesEl.className = "ticket-route-names";
    namesEl.textContent = names;
    container.querySelector(".ticket-route").after(namesEl);
  }

  for (const [left, right] of ticketRows(pass)) {
    const section = document.createElement("div");
    section.className = "ticket-section";
    section.append(ticketCell(left, "left"));
    if (right) section.append(ticketCell(right, "right"));
    detail.appendChild(section);
  }

  const gate = gateCloseTime(pass);
  if (gate) {
    const hint = document.createElement("div");
    hint.className = "ticket-hint";
    hint.textContent = GATE_HINT;
    detail.appendChild(hint);
  }

  container.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => exportTicket(button, pass));
  });

  const slot = container.querySelector(".aztec-canvas");
  const owner = barcodeOwner.get(pass);

  if (owner) {
    slot.appendChild(buildNoticeElement(sharedBarcodeNotice(pass, owner)));
  } else if (hasBarcode(pass)) {
    const canvas = document.createElement("canvas");
    drawAztec(canvas, pass.barcode, 3);
    slot.appendChild(canvas);
  } else {
    slot.appendChild(buildNoticeElement(missingBarcodeNotice(pass)));
  }
}

// The same message the printed card carries, shown where the barcode would be.
function buildNoticeElement(notice) {
  const box = document.createElement("div");
  box.className = `pass-notice ${notice.tone}`;

  const icon = document.createElement("div");
  icon.className = "pass-notice-icon";
  icon.textContent = notice.icon;

  const title = document.createElement("div");
  title.className = "pass-notice-title";
  title.textContent = notice.title;

  box.append(icon, title);

  for (const paragraph of notice.lines) {
    const line = document.createElement("p");
    line.textContent = paragraph;
    box.appendChild(line);
  }

  return box;
}

async function exportTicket(button, pass) {
  const mode = button.dataset.export;
  const original = button.textContent;

  button.disabled = true;
  try {
    if (mode === "a4") {
      setStatus("Building A4 page...");
      await saveA4Pdf([pass], "single", passFilename(pass, "pdf"));
      setStatus("A4 PDF saved! 🖨️");
    } else {
      const blob = await canvasToBlob(drawTicketToCanvas(pass));

      if (mode === "copy") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setStatus("Copied to clipboard! 📋");
      } else {
        await saveBlob(blob, passFilename(pass, "png"));
        setStatus("Image saved! 🖼️");
      }
    }

    button.textContent = randomQuack();
    setTimeout(() => { button.textContent = original; }, 2000);
  } catch (error) {
    console.error(error);
    setStatus(`Export failed: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

// ------------------------------------------------------------------ actions

const PASS_ACTIONS = [
  {
    id: "apple",
    label: "Download Apple Wallet Pass",
    run: async (payload, pass) => {
      const blob = await downloadPass(payload);
      await saveBlob(blob, passFilename(pass, "pkpass"));
    },
  },
  {
    id: "google",
    label: "Add to Google Wallet",
    run: async (payload) => {
      const token = await fetchGoogleWalletToken(payload);
      await chrome.tabs.create({ url: `${GOOGLE_WALLET_SAVE_URL}/${encodeURIComponent(token)}` });
    },
  },
];

async function downloadAllPasses(passes, payloads) {
  const button = document.getElementById("btn-download-all");
  const original = button ? button.textContent : "";
  if (button) {
    button.disabled = true;
    button.textContent = "Downloading...";
  }

  setStatus("Preparing passes...");
  try {
    const entries = await Promise.all(
      passes.map(async (pass, i) => {
        const base = passBaseName(pass);
        const png = await canvasToBlob(drawTicketToCanvas(pass));
        const files = [{ name: `${base}.png`, data: new Uint8Array(await png.arrayBuffer()) }];

        // A pass with no barcode has no wallet file behind it either.
        if (hasBarcode(pass)) {
          const pkpass = await downloadPass(payloads[i]);
          files.push({
            name: `${base}.pkpass`,
            data: new Uint8Array(await pkpass.arrayBuffer()),
          });
        }

        return files;
      })
    );

    const zip = buildZip(entries.flat());
    await saveBlob(new Blob([zip], { type: "application/zip" }), "passes.zip");
    setStatus(`Downloaded ${passes.length} passes! ✅`);
  } catch (error) {
    setStatus(`Download failed: ${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

// ------------------------------------------------------------------- render

const searchHaystack = (pass) =>
  [
    pass.pnr,
    pass.name.first,
    pass.name.last,
    pass.departure.code,
    pass.arrival.code,
    pass.flight.carrierCode,
    pass.flight.number,
  ]
    .join(" ")
    .toLowerCase();

function visibleIndices() {
  return [...passesEl.querySelectorAll(".pass")]
    .filter((row) => row.style.display !== "none")
    .map((row) => Number(row.dataset.index))
    .filter((i) => !Number.isNaN(i));
}

function renderPasses(passes, payloads) {
  passes.forEach((pass, index) => {
    const row = document.createElement("div");
    row.className = "pass";
    row.dataset.search = searchHaystack(pass);
    row.dataset.index = String(index);

    const title = document.createElement("div");
    title.className = "pass-title";
    title.textContent =
      `${pass.pnr} · ${pass.departure.code} → ${pass.arrival.code} · ` +
      `${pass.name.first} ${pass.name.last}`;

    const meta = document.createElement("div");
    meta.className = "pass-meta";
    meta.textContent =
      `${pass.flight.carrierCode} ${pass.flight.number} · ` +
      `${formatDate(pass.departure.date)} · Seat ${pass.seat.designator}`;

    let warning = null;
    const owner = barcodeOwner.get(pass);
    if (owner) {
      warning = document.createElement("div");
      warning.className = "pass-shared";
      warning.textContent = `👶 Uses ${fullName(owner)}'s barcode`;
    } else if (!hasBarcode(pass)) {
      warning = document.createElement("div");
      warning.className = "pass-warning";
      warning.textContent = `⚠ ${NOTICE_TITLE}`;
    }

    const actions = document.createElement("div");
    actions.className = "pass-actions";

    const outputBox = document.createElement("div");
    outputBox.className = "pass-qr";

    const showButton = document.createElement("button");
    showButton.textContent = "Show Ticket";
    showButton.dataset.action = "qr";
    showButton.addEventListener("click", () => {
      if (showButton.textContent === "Hide Ticket") {
        outputBox.innerHTML = "";
        showButton.textContent = "Show Ticket";
        return;
      }
      try {
        renderTicketDetails(outputBox, pass);
        showButton.textContent = "Hide Ticket";
      } catch (error) {
        setStatus(`Error: ${error.message}`);
      }
    });
    actions.appendChild(showButton);

    PASS_ACTIONS.forEach((action) => {
      const button = document.createElement("button");
      button.textContent = action.label;
      button.dataset.action = action.id;

      // Without a barcode there is no wallet pass to hand out.
      if (!hasBarcode(pass)) {
        button.disabled = true;
        button.title = NOTICE_TITLE;
        actions.appendChild(button);
        return;
      }

      button.addEventListener("click", async () => {
        button.disabled = true;
        setStatus("Grabbing pass...");
        try {
          await action.run(payloads[index], pass);
          setStatus(READY_QUACK);
        } catch (error) {
          setStatus(`Error: ${error.message}`);
        } finally {
          button.disabled = false;
        }
      });
      actions.appendChild(button);
    });

    row.append(title, meta);
    if (warning) row.appendChild(warning);
    row.append(actions, outputBox);
    passesEl.appendChild(row);
  });
}

function checkinLabel(flight) {
  if (flight.checkinStatus !== "nocheckin") return flight.checkinStatus;

  const now = Date.now();
  const open = flight.checkInOpenUTC ? Date.parse(flight.checkInOpenUTC) : null;
  const close = flight.checkInCloseUTC ? Date.parse(flight.checkInCloseUTC) : null;
  const isOpen = open !== null && now >= open && (close === null || now <= close);

  return isOpen ? "Check-in open" : "Check-in not open";
}

function renderFlights(flights) {
  flights.forEach((flight) => {
    const row = document.createElement("div");
    row.className = "flight-summary";

    const title = document.createElement("div");
    title.className = "pass-title";
    title.textContent = `${flight.pnr} · ${flight.origin} → ${flight.destination}`;

    const meta = document.createElement("div");
    meta.className = "pass-meta";
    meta.textContent = checkinLabel(flight);

    const details = document.createElement("div");
    details.className = "pass-meta";
    const when = new Date(flight.date);
    details.textContent =
      `${flight.flightNumber} · ${when.toLocaleDateString("en-GB")} ` +
      `${when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

    row.append(title, meta, details);
    passesEl.appendChild(row);
  });
}

function renderBulkActions(passes, payloads) {
  if (passes.length <= 1) return;

  const button = document.createElement("button");
  button.id = "btn-download-all";
  button.className = "btn-download-all";
  button.textContent = "Download All Passes";
  button.addEventListener("click", () => {
    const indices = visibleIndices();
    downloadAllPasses(indices.map((i) => passes[i]), indices.map((i) => payloads[i]));
  });
  bulkActionsEl.appendChild(button);
}

function renderPrintPanel(passes) {
  const panel = document.createElement("div");
  panel.className = "print-panel";

  const title = document.createElement("div");
  title.className = "print-title";
  title.textContent = "Print sheet — A4 PDF, wallet-size tickets";
  panel.appendChild(title);

  if (passes.length > 1) {
    const options = [
      ["sheet", "All tickets of a booking on one page"],
      ["single", "Each ticket on its own page"],
    ];

    options.forEach(([value, label], i) => {
      const row = document.createElement("label");
      row.className = "print-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "qp-a4-mode";
      input.value = value;
      input.checked = i === 0;

      row.append(input, document.createTextNode(label));
      panel.appendChild(row);
    });
  }

  const button = document.createElement("button");
  button.id = "btn-a4";
  button.className = "btn-a4";
  button.textContent = "Download A4 PDF";
  button.addEventListener("click", async () => {
    const selected = panel.querySelector("input[name='qp-a4-mode']:checked");
    const mode = selected ? selected.value : "sheet";
    const chosen = visibleIndices().map((i) => passes[i]);

    if (chosen.length === 0) return;

    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Building...";
    setStatus("Laying out the A4 page...");

    try {
      const pageCount = await saveA4Pdf(chosen, mode, "boarding-passes-a4.pdf");
      setStatus(`A4 PDF saved — ${pageCount} page${pageCount === 1 ? "" : "s"} 🖨️`);
    } catch (error) {
      console.error(error);
      setStatus(`A4 export failed: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
  panel.appendChild(button);

  bulkActionsEl.appendChild(panel);
}

function renderSearchBar(passes) {
  if (passes.length < SEARCH_MIN_PASSES) return;

  const input = document.createElement("input");
  input.type = "search";
  input.className = "search-input";
  input.placeholder = "Search by name or reference...";
  input.autocomplete = "off";
  input.spellcheck = false;

  const emptyHint = document.createElement("div");
  emptyHint.className = "search-empty";
  emptyHint.textContent = "No passes match your search 🦆";
  emptyHint.hidden = true;

  const autoOpened = new Set();

  input.addEventListener("input", () => {
    const tokens = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const visible = [];

    passesEl.querySelectorAll(".pass").forEach((row) => {
      const match = tokens.every((t) => (row.dataset.search || "").includes(t));
      row.style.display = match ? "" : "none";
      if (match) visible.push(row);
    });

    emptyHint.hidden = tokens.length === 0 || visible.length > 0;

    const bulkButton = document.getElementById("btn-download-all");
    if (bulkButton) {
      bulkButton.textContent =
        tokens.length === 0 ? "Download All Passes" : `Download Results (${visible.length})`;
      bulkButton.disabled = visible.length === 0;
    }

    const a4Button = document.getElementById("btn-a4");
    if (a4Button) a4Button.disabled = visible.length === 0;

    // A single match is almost always the pass you want open at the gate.
    if (tokens.length > 0 && visible.length === 1) {
      const showButton = visible[0].querySelector('button[data-action="qr"]');
      if (showButton && showButton.textContent === "Show Ticket") {
        autoOpened.add(showButton);
        showButton.click();
      }
    } else {
      autoOpened.forEach((b) => { if (b.textContent === "Hide Ticket") b.click(); });
      autoOpened.clear();
    }
  });

  searchBarEl.append(input, emptyHint);
}

function renderAll({ passes, downloadPayloads, flights }) {
  indexArrivals(flights);
  indexSharedBarcodes(passes);

  passesEl.innerHTML = "";
  bulkActionsEl.innerHTML = "";
  searchBarEl.innerHTML = "";

  if (passes.length > 0) {
    renderPasses(passes, downloadPayloads);
    renderBulkActions(passes, downloadPayloads);
    renderPrintPanel(passes);
    renderSearchBar(passes);
  }

  const upcoming = flights.filter((f) => !f.isReady);
  if (upcoming.length > 0) renderFlights(upcoming);

  return { passCount: passes.length, upcomingCount: upcoming.length };
}

// --------------------------------------------------------------------- boot

async function readCache() {
  try {
    const stored = await chrome.storage.local.get("cachedPasses");
    return stored.cachedPasses || null;
  } catch (error) {
    console.error("Cache read error", error);
    return null;
  }
}

function sendFetchRequest() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "QP_FETCH_BOARDING_PASSES" }, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!response) return reject(new Error("No response from background"));
      if (!response.ok) return reject(new Error(response.error));
      resolve(response.data);
    });
  });
}

async function main() {
  if (new URLSearchParams(location.search).get("view") === "tab") {
    document.body.classList.add("tab");
  }

  setStatus("Paddling to Ryanair...");

  const cached = await readCache();

  // Show a fresh cache straight away so the popup is never blank.
  if (cached && cached.cachedAt && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    renderAll(cached);
    setStatus("Offline mode ☁️");
  }

  try {
    const data = await sendFetchRequest();
    const { passCount, upcomingCount } = renderAll(data);

    if (passCount > 0) {
      setStatus(READY_QUACK);
    } else if (upcomingCount > 0) {
      setStatus("Too early to fly! 🐣 Tickets appear once you check in.");
    } else {
      setStatus("Nothing to quack.");
    }
  } catch (error) {
    const message = error.message || String(error);

    if (message.includes("LOGIN_REQUIRED")) {
      setStatus("Please log in on ryanair.com 🔒");
    } else if (message.includes("NO_PASSES")) {
      setStatus("Nothing to quack.");
    } else if (cached) {
      if (passesEl.innerHTML === "") renderAll(cached);
      setStatus("Offline (cached) ☁️");
    } else {
      setStatus(`Error: ${message}`);
    }
  }
}

main();
