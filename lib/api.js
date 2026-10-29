import {
  API_BOARDING_PASS_URL,
  API_DOWNLOAD_PASS_URL,
  API_GOOGLE_WALLET_URL,
  API_ORDERS_URL,
} from "./config.js";

const JSON_HEADERS = {
  "content-type": "application/json",
  accept: "*/*",
  client: "ios",
};

const PKPASS_HEADERS = {
  "content-type": "application/json",
  accept: "application/vnd.apple.pkpass",
  client: "ios",
};

const GOOGLE_WALLET_HEADERS = {
  "content-type": "application/json",
  accept: "*/*",
  client: "android",
};

// Ryanair answers slowly at times; never let the popup spin forever.
const REQUEST_TIMEOUT_MS = 20_000;
const withTimeout = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS);

// Ryanair returns 25 bookings per page with a nextToken cursor for the rest.
const ORDERS_MAX_PAGES = 50;
// The passes endpoint is happier with small batches of booking ids.
const PASSES_CHUNK_SIZE = 20;

// GET the customer's active flight orders, following every page.
export async function fetchOrders(customerId, xAuthToken) {
  const items = [];
  const seen = new Set();
  let nextToken = null;

  for (let page = 0; ; page++) {
    if (page >= ORDERS_MAX_PAGES) throw new Error("orders failed: too many pages");

    const url =
      `${API_ORDERS_URL}/orders/v2/orders/${customerId}/details` +
      `?type=flight&active=true&order=ASC` +
      (nextToken ? `&nextToken=${encodeURIComponent(nextToken)}` : "");

    const response = await fetch(url, {
      method: "GET",
      headers: { ...JSON_HEADERS, "x-auth-token": xAuthToken },
      credentials: "include",
      signal: withTimeout(),
    });

    if (!response.ok) {
      if (response.status === 403) throw new Error("LOGIN_REQUIRED");
      throw new Error(`orders failed: ${response.status}`);
    }

    const data = await response.json();
    for (const item of data?.items ?? []) {
      const key = item?.rawBooking?.bookingId ?? item?.rawBooking?.recordLocator ?? JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }

    nextToken = typeof data?.nextToken === "string" && data.nextToken.trim() ? data.nextToken : null;
    if (!nextToken) break;
  }

  return { items };
}

// POST the booking ids we want passes for, a chunk at a time. Returns one
// entry per passenger/leg. A chunk Ryanair refuses (403, e.g. nothing to show
// for those bookings) is skipped; any other failure aborts so the cache is
// never overwritten with a partial list.
export async function fetchBoardingPasses(payload) {
  const ids = payload.bookingIds ?? [];
  const passes = [];
  let refused = 0;

  for (let i = 0; i < ids.length; i += PASSES_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + PASSES_CHUNK_SIZE);
    const response = await fetch(`${API_BOARDING_PASS_URL}/v1/boardingpasses`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "x-auth-token": payload.xAuthToken },
      credentials: "include",
      body: JSON.stringify({ ...payload, bookingIds: chunk }),
      signal: withTimeout(),
    });

    if (response.status === 403) {
      if (!payload.xAuthToken) throw new Error("LOGIN_REQUIRED");
      refused++;
      continue;
    }
    if (!response.ok) throw new Error(`boardingpasses failed: ${response.status}`);

    const data = await response.json();
    if (Array.isArray(data)) passes.push(...data);
  }

  if (passes.length === 0 && refused > 0) throw new Error("NO_PASSES");
  return passes;
}

// Apple Wallet .pkpass for a single pass.
export async function downloadPass(payload) {
  const response = await fetch(`${API_DOWNLOAD_PASS_URL}/v1/downloadpass`, {
    method: "POST",
    headers: PKPASS_HEADERS,
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`downloadpass failed: ${response.status}`);

  return response.blob();
}

// Google Wallet "save to phone" JWT for a single pass.
export async function fetchGoogleWalletToken(payload) {
  const response = await fetch(`${API_GOOGLE_WALLET_URL}/v1/boardingpass`, {
    method: "PUT",
    headers: GOOGLE_WALLET_HEADERS,
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`google wallet boardingpass failed: ${response.status}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("google wallet boardingpass returned invalid JSON");
  }

  if (!data || typeof data.Token !== "string" || !data.Token.trim()) {
    throw new Error("google wallet boardingpass returned no token");
  }

  return data.Token;
}
