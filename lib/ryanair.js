// The session cookie is a JWT; its "sub" claim is the customer id.
export function decodeCustomerId(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json).sub || null;
  } catch {
    return null;
  }
}

// Flatten the orders payload into one row per flight leg.
export function extractFlightsFromOrders(orders) {
  if (!orders || !orders.items) return [];

  return orders.items.flatMap((item) => {
    const raw = item.rawBooking;
    if (!raw || !raw.flights) return [];

    return raw.flights.map((flight) => {
      const checkin = raw.checkins?.find((c) => c.journeyNum === flight.journeyNum);
      const status = checkin?.status || "unknown";

      return {
        bookingId: raw.bookingId,
        pnr: raw.recordLocator || "",
        origin: flight.origin,
        destination: flight.destination,
        date: flight.times?.departUTC || "",
        // The boarding pass itself carries no arrival time, so keep the one the
        // bookings response gives us and match it up in the popup.
        arrivalDate: flight.times?.arriveUTC || flight.times?.arrivalUTC || "",
        flightNumber: flight.flightNumber,
        journeyNum: flight.journeyNum,
        checkinStatus: status,
        isReady: status !== "nocheckin",
        checkInOpenUTC: flight.checkInOpenUTC,
        checkInCloseUTC: flight.checkInCloseUTC,
      };
    });
  });
}

// Per-passenger extras — bags, Fast Track, infants — live in the bookings
// response as "SSRs": rawBooking.ssrs = [{ code, paxNum, journeyNum? }], with
// rawBooking.passengers mapping paxNum to a name. The boarding-pass response
// never carries them, so they are matched to each pass here by booking, leg
// and passenger name.

const letters = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z]/g, "");
const compact = (s) => String(s ?? "").replace(/\s+/g, "").toUpperCase();

// Names can be truncated or carry a middle name on one side only.
const sameName = (a, b) =>
  a.last === b.last && (a.first.startsWith(b.first) || b.first.startsWith(a.first));

export function extractExtrasFromOrders(orders) {
  const bookings = new Map(); // pnr -> [{ name, journeyNum, ssr }]

  for (const item of orders?.items ?? []) {
    const raw = item.rawBooking;
    if (!raw) continue;

    const names = new Map();
    for (const p of raw.passengers ?? []) {
      names.set(p.paxNum, {
        first: letters(p.name?.first ?? p.firstName ?? p.first),
        last: letters(p.name?.last ?? p.lastName ?? p.last),
      });
    }

    const rows = [];
    for (const ssr of raw.ssrs ?? []) {
      const name = names.get(ssr.paxNum);
      if (name) rows.push({ name, journeyNum: ssr.journeyNum, ssr });
    }
    bookings.set(compact(raw.recordLocator), rows);
  }

  return bookings;
}

export function extrasForPass(pass, flights, bookings) {
  const rows = bookings.get(compact(pass.pnr));
  if (!rows || rows.length === 0) return [];

  const name = { first: letters(pass.name?.first), last: letters(pass.name?.last) };
  const flightNo = compact(`${pass.flight?.carrierCode ?? ""}${pass.flight?.number ?? ""}`);
  const day = String(pass.departure?.date ?? "").slice(0, 10);

  const leg = flights.find(
    (f) =>
      compact(f.pnr) === compact(pass.pnr) &&
      compact(f.flightNumber) === flightNo &&
      (!day || !f.date || String(f.date).slice(0, 10) === day)
  );

  return rows
    .filter((r) => sameName(r.name, name))
    .filter((r) => r.journeyNum == null || leg?.journeyNum == null || r.journeyNum === leg.journeyNum)
    .map((r) => r.ssr);
}

// Only checked-in bookings actually have passes. De-duplicate the ids.
export function filterReadyBookings(flights) {
  return [...new Set(flights.filter((f) => f.isReady).map((f) => f.bookingId))];
}

export function isInfant(paxType) {
  return paxType === "INF";
}

// Body accepted by /v1/downloadpass and /v1/boardingpass.
export function buildDownloadPayload(pass) {
  return {
    sequenceNumber: String(pass.sequence),
    lang: "en",
    arrivalStation: pass.arrival.code,
    departureStation: pass.departure.code,
    recordLocator: pass.pnr,
    isInfant: isInfant(pass.paxType),
  };
}
