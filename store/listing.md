# Chrome Web Store listing — copy/paste sheet

Everything the Developer Dashboard asks for. Fill the two placeholders before
you submit:

Both are filled in already:

- Privacy policy: https://chlomo2001.github.io/quackpass/privacy-policy.html
- Contact: oiberchuchem1@gmail.com

The **upload package is already built**: `../../quackpass-1.0.0.zip`
(manifest at the archive root, `dev/` and `store/` excluded, forward-slash paths,
verified by packing it with Chrome).

---

## Comes from the manifest — do not retype

The store takes these two straight from `manifest.json`, so they are already set:

| Field | Value | Limit |
| --- | --- | --- |
| Name | QuackPass — Boarding Passes in Your Browser | 43 / 75 |
| Summary | View, save and print your Ryanair boarding passes in your browser. No phone needed. Runs locally, nothing is uploaded. | 118 / 132 |

To change either one, edit `manifest.json` and re-zip — not the dashboard.

---

## Store listing tab

### Category

`Travel`

### Language

`English (United Kingdom)`

### Detailed description (max 16,000 characters)

```
QuackPass shows your Ryanair boarding passes in your browser, so you are not
stuck if your phone is dead, lost, out of storage, or simply not with you.

Log in on ryanair.com as you normally would, click the duck, and your checked-in
passes appear — with the scannable barcode, seat, sequence number and boarding
time.


WHAT YOU CAN DO

• See the scannable barcode for every checked-in passenger.
• Save an Apple Wallet pass (.pkpass) for your iPhone.
• Add a pass to Google Wallet on Android.
• Save or copy a ticket as a sharp PNG image.
• Print an A4 sheet as a PDF, with wallet-size tickets and dashed cut lines.
  Choose all the tickets of one booking on a single page, or one per page.
• Download everything for a booking at once as a single ZIP.
• Search by passenger name or booking reference when you are travelling with
  a group.
• See your upcoming flights and whether check-in has opened yet.
• A "No Smartphone? Click Here!" button appears on the booking page itself,
  right where you would expect it.


PRINTING THAT ACTUALLY WORKS

Tickets on the A4 sheet are never printed larger than wallet size, so you can
cut them out and carry them. With several passengers they are tiled onto one
page. The PDF uses lossless compression, because JPEG artefacts on a barcode
can stop a gate scanner reading it.


YOUR PRIVACY

QuackPass has no servers and no analytics. It talks to ryanair.com using the
session you are already logged into, and everything else happens inside your
browser. Nothing is uploaded, collected, sold or shared. The only thing it
stores is a copy of your last result, kept on your own computer so the popup
still shows something when you are offline.

QuackPass is free and open source, so you can read every line of it yourself.


HOW TO USE IT

1. Log in on ryanair.com in the same browser.
2. Check in for your flight as usual.
3. Click the QuackPass icon, or the button on the booking page.


GOOD TO KNOW

• You must already be checked in. Passes do not exist before check-in opens.
• Some airports and airlines will not accept a printed or screenshotted pass.
  Check the rules for your route before you rely on it.
• QuackPass is an independent tool. It is not affiliated with, endorsed by,
  authorised by, or connected to Ryanair. All trademarks belong to their owners.
• For personal, non-commercial use.
```

---

## Privacy tab

### Single purpose description

```
QuackPass has one purpose: to show the signed-in user their own boarding passes
in the browser, and let them save or print those passes. Every feature serves
that one purpose.
```

### Permission justifications

**`cookies`**

```
Used to read one cookie — the user's own session cookie on ryanair.com — so the
extension can call the airline's API as the signed-in user and retrieve that
user's own boarding passes. Without it the extension cannot tell the airline who
is asking. The cookie value is used only in the authorization header of requests
sent to the airline's own servers. It is never stored, logged, or transmitted
anywhere else.
```

**`storage`**

```
Used to cache the user's last boarding pass result in local storage, so the
popup still shows their pass if they open it at the airport with no connection.
Nothing else is stored, and the cache never leaves the user's computer.
```

**`downloads`**

```
Used to save the files the user explicitly asks for: an Apple Wallet .pkpass
file, a PNG image of a ticket, an A4 PDF print sheet, or a ZIP of all passes in
a booking. A download only ever happens as the direct result of the user
clicking a button.
```

**`clipboardWrite`**

```
Used for the "Copy Image" button, which places a PNG of the user's own ticket on
the clipboard so they can paste it into a message or a document.
```

**Host permission — `https://*.ryanair.com/*`**

```
These are the airline's own endpoints the extension calls to fetch the user's
bookings and boarding passes, to download an Apple Wallet pass, and to obtain a
Google Wallet save link. The extension contacts no other host. There is no
backend server of our own.
```

**Content script on `https://*.ryanair.com/*`**

```
A small script adds one button to the airline's booking page, next to the
airline's own "Access boarding passes" button, so the user can open their passes
from where they already are. The script reads nothing from the page and sends
nothing anywhere. Its only action is to ask the extension to open its own page
when the button is clicked.
```

**Remote code**

```
No. All code is included in the package. The barcode library (bwip-js, MIT) is
bundled locally. Nothing is fetched and executed at runtime.
```

### Data usage — what to tick

Tick **nothing** in the data collection list, then certify all three statements:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy policy URL

```
https://chlomo2001.github.io/quackpass/privacy-policy.html
```

---

## Assets

| Asset | Size | Status |
| --- | --- | --- |
| Screenshots | 1280×800 PNG | ✅ `store/screenshots/screenshot-1..4.png` |
| Store icon | 128×128 PNG | ✅ `icons/icon128.png` |
| Small promo tile | 440×280 PNG | Optional, not made |
| Marquee promo tile | 1400×560 PNG | Optional, not made |

All four screenshots use invented passengers and invented barcodes. No real
booking data appears in any of them.

---

## Packaging

The zip is already built at `quackpass-1.0.0.zip`. To rebuild it after a change,
bump `version` in `manifest.json` first, then:

```bash
cd quackpass && zip -r ../quackpass-1.0.1.zip . -x "dev/*" "store/*" "docs/*" ".git/*"
```

Do **not** use PowerShell's `Compress-Archive` — it writes Windows backslashes
into the archive paths, which the store can reject. Use the `zip` command (it
ships with Git for Windows), or the .NET `ZipArchive` API with the entry names
normalised to forward slashes.

---

## Before you submit — read this

- **Trademark.** The airline's name stays out of the extension name, the icon and
  the promo tiles. Naming it in the description to say what it works with is
  normal descriptive use; branding yourself as the airline is not.
- **Review time.** `cookies` plus host permissions means a human will look at
  this. Expect days, sometimes a few weeks. The clear justifications above are
  what shortens it.
- **The airline may object.** Boarding passes were moved into the app on purpose.
  A takedown request is a realistic outcome, whatever the store decides.
- **Do not claim it is official.** The description says plainly that it is
  independent. Keep that line in.
