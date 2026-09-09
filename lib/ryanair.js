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
        checkinStatus: status,
        isReady: status !== "nocheckin",
        checkInOpenUTC: flight.checkInOpenUTC,
        checkInCloseUTC: flight.checkInCloseUTC,
      };
    });
  });
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
