import { fetchBoardingPasses, fetchOrders } from "./lib/api.js";
import {
  buildDownloadPayload,
  decodeCustomerId,
  extractFlightsFromOrders,
  filterReadyBookings,
} from "./lib/ryanair.js";

async function getAuthToken() {
  const cookie = await chrome.cookies.get({
    url: "https://www.ryanair.com",
    name: "SESSION_COOKIE",
  });
  return cookie ? cookie.value : null;
}

async function loadEverything() {
  const token = await getAuthToken();
  if (!token) throw new Error("LOGIN_REQUIRED");

  const customerId = decodeCustomerId(token);
  if (!customerId) throw new Error("LOGIN_REQUIRED");

  const orders = await fetchOrders(customerId, token);
  const flights = extractFlightsFromOrders(orders);
  const bookingIds = filterReadyBookings(flights);

  let passes = [];
  if (bookingIds.length > 0) {
    passes = await fetchBoardingPasses({ customerId, bookingIds, xAuthToken: token });
  }

  const result = { flights, passes, downloadPayloads: passes.map(buildDownloadPayload) };

  // Keep a copy so the popup still shows something without a connection.
  chrome.storage.local.set({ cachedPasses: { ...result, cachedAt: Date.now() } });

  return result;
}

// The in-page button cannot open the toolbar popup, so give it a full tab.
// Reusing an already-open tab would need the "tabs" permission, which asks the
// user for their browsing history; a fresh tab is not worth that.
function openPassesTab() {
  return chrome.tabs.create({ url: chrome.runtime.getURL("popup/popup.html?view=tab") });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return;

  if (message.type === "QP_OPEN_PASSES") {
    openPassesTab();
    return;
  }

  if (message.type !== "QP_FETCH_BOARDING_PASSES") return;

  loadEverything().then(
    (data) => sendResponse({ ok: true, data }),
    (error) => sendResponse({ ok: false, error: error.message })
  );

  return true; // keep the message channel open for the async reply
});
