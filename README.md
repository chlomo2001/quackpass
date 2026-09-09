# QuackPass 🦆

A Chrome (Manifest V3) extension that fetches, shows and downloads your Ryanair
boarding passes directly in the browser — no phone app needed.

It is a rebuild of the idea behind [RyanQuack](https://github.com/Ax6/ryanquack)
(GPL-3.0, by Aaron Russo), written from scratch as plain JavaScript with no build
step, so you can load it unpacked straight away.

## What it does

- Reads your Ryanair session cookie and lists every active booking.
- Shows a scannable **Aztec code** for each checked-in passenger — the same code
  the gate scanner reads.
- **Download Apple Wallet Pass** — saves the real `.pkpass` file.
- **Add to Google Wallet** — opens the official `pay.google.com` save link.
- **Save / Copy Image** — a high-resolution PNG ticket, wallet size when printed.
- **A4 PDF print sheet** — wallet-size tickets laid out on A4 with dashed cut
  guides. Either all tickets of a booking on one page, or one ticket per page.
  Cards never print larger than wallet size (64 mm wide); with many passengers
  they shrink to fit, and only spill onto a second page if they would become
  unreadable.
- **Download All Passes** — one `passes.zip` with a `.pkpass` + `.png` per passenger.
- **Search** by name or booking reference; a single match opens by itself.
- Shows the **booking reference** on every ticket, on screen and in every export.
- Shows **gate closing, departure and arrival times**, plus the **terminal**
  where the airline provides one. The gate closing time is always the ticket's
  own departure time minus 30 minutes, which is when Ryanair closes the gate and
  can refuse boarding; the ticket prints that rule underneath.
- Shows the **full airport names** under the route codes, and the **Hebrew
  calendar date** under the travel date, in traditional letter numerals
  (e.g. `כ״ט בחשוון תשפ״ז`).
- When Ryanair returns a pass with **no barcode**, a notice appears in its place,
  on screen and on the printed ticket. It says what is missing, names the
  destination country, and suggests the usual cause (entry documents not yet
  checked or linked) without asserting it, because the API never says why. The
  wallet buttons are disabled for that passenger, since there is no wallet pass
  behind them.
- Adds a **"No Smartphone? Click Here!" button on ryanair.com itself**, right
  under Ryanair's own "Access boarding passes", which opens your passes in a
  new tab.
- Lists **upcoming flights** that are not checked in yet, with check-in status.
- Caches the last result, so the popup still shows something offline.

Everything runs locally. Nothing is sent anywhere except to Ryanair's own API.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder (`quackpass`).
4. Log in on <https://www.ryanair.com> in the same browser.
5. Click the duck icon.

Works the same in Edge, Brave and other Chromium browsers.

## How it works

| Step | Endpoint |
| --- | --- |
| Session token | `SESSION_COOKIE` on `www.ryanair.com` (a JWT; `sub` = customer id) |
| Bookings | `GET services-api.ryanair.com/orders/v2/orders/{customerId}/details?type=flight&active=true` |
| Passes | `POST mntappbp.ryanair.com/v1/boardingpasses` |
| Apple Wallet | `POST mawbp.ryanair.com/v1/downloadpass` |
| Google Wallet | `PUT mgpbp.ryanair.com/v1/boardingpass` → token → `pay.google.com/gp/v/save/{token}` |

The service worker (`background.js`) does the authenticated calls; the popup
renders and exports. Aztec codes come from the bundled `vendor/bwip-js.min.js`.

## Files

```
manifest.json        MV3 manifest, permissions
background.js        service worker: cookie -> orders -> passes -> cache
lib/config.js        endpoints and cache TTL
lib/api.js           the four Ryanair HTTP calls
lib/ryanair.js       JWT decode, orders parsing, payload building
lib/zip.js           tiny STORE-only zip writer for "download all"
lib/pdf.js           minimal PDF writer (lossless, so barcodes stay scannable)
lib/airports.js      IATA code -> airport name and country
lib/hebrew.js        Hebrew calendar date with letter numerals (gematria)
popup/               popup UI (html, css, js); also used as a full tab
content/content.js   injects the button on ryanair.com pages
vendor/bwip-js.min.js  Aztec barcode renderer (MIT)
dev/mock.html        run the popup as a normal page with fake data
dev/mock-site.html   fake booking page for testing the injected button
dev/shots.html       renders the 1280x800 store screenshots
store/               store listing copy, privacy policy draft, screenshots
docs/                GitHub Pages site: landing page + hosted privacy policy
LICENSE              GPL-3.0
icons/               extension icons
```

## Developing

`dev/mock.html` renders the popup with fake passes and stubbed `chrome.*` APIs,
so you can work on the UI without a real booking:

```bash
python -m http.server 4321 -d quackpass
```

Then open:

- <http://localhost:4321/dev/mock.html> — the popup
- <http://localhost:4321/dev/mock.html?view=tab> — the popup in full-tab layout
- <http://localhost:4321/dev/mock-site.html> — the injected in-page button

## Publishing

`store/listing.md` has every Chrome Web Store field ready to paste. The privacy
policy is served from `docs/` via GitHub Pages, and the upload package is built
at `../quackpass-1.0.0.zip`.

To publish the policy: push this repo to GitHub, then **Settings → Pages →
Source: `main` branch, `/docs` folder**. The policy is then at
`https://<user>.github.io/<repo>/privacy-policy.html`.

## Notes

- Not affiliated with, endorsed by, or connected to Ryanair. Personal,
  non-commercial use only.
- Ryanair can change these private endpoints at any time; if the popup starts
  failing, that is the first thing to check.
- Rename the extension freely — `name` in `manifest.json` and the header text in
  `popup/popup.html`.
