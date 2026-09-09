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

// GET the customer's active flight orders.
export async function fetchOrders(customerId, xAuthToken) {
  const url =
    `${API_ORDERS_URL}/orders/v2/orders/${customerId}/details` +
    `?type=flight&active=true`;

  const response = await fetch(url, {
    method: "GET",
    headers: { ...JSON_HEADERS, "x-auth-token": xAuthToken },
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 403) throw new Error("LOGIN_REQUIRED");
    throw new Error(`orders failed: ${response.status}`);
  }

  return response.json();
}

// POST the booking ids we want passes for. Returns one entry per passenger/leg.
export async function fetchBoardingPasses(payload) {
  const response = await fetch(`${API_BOARDING_PASS_URL}/v1/boardingpasses`, {
    method: "POST",
    headers: { ...JSON_HEADERS, "x-auth-token": payload.xAuthToken },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(payload.xAuthToken ? "NO_PASSES" : "LOGIN_REQUIRED");
    }
    throw new Error(`boardingpasses failed: ${response.status}`);
  }

  return response.json();
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
