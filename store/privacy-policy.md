# Privacy Policy — QuackPass

> The published copy is [`docs/privacy-policy.html`](../docs/privacy-policy.html).
> Edit both together, or treat this file as the readable draft.

**Last updated: 9 September 2026**

QuackPass is a browser extension that shows you your own boarding passes.
This policy explains, plainly, what it does with your information.

## The short version

QuackPass collects nothing. It has no servers, no accounts and no analytics.
Everything happens inside your own browser.

## What QuackPass does with your data

To show your boarding passes, QuackPass reads the session cookie that the
airline's website already set in your browser when you logged in. It sends that
cookie to the airline's own servers — the same servers your browser is already
talking to — to ask for **your own** bookings and boarding passes.

That is the entire data flow. The cookie is used in the request and then
forgotten. It is not stored, copied, logged or sent anywhere else.

## What is stored on your computer

A copy of your most recent result — your flights and boarding passes — is kept
in your browser's local extension storage. This exists so the popup still shows
your pass if you open it at the airport with no connection.

This copy never leaves your computer. You can delete it at any time by removing
the extension, or by clearing the extension's data from your browser settings.

## What is not collected

QuackPass does **not** collect, transmit, sell, share or process:

- personal or contact information
- your boarding passes, bookings or travel history
- authentication information
- location
- browsing history or web activity
- analytics, telemetry, crash reports or usage statistics

There is nowhere for such data to go. QuackPass has no backend of its own.

## Who your data is shared with

Nobody. QuackPass contacts exactly one party: the airline's own website, on your
behalf, as you. It sends nothing to the developer or to any third party.

## Files you save

When you save a pass, a ticket image, an A4 PDF or a ZIP, the file is written to
your computer by your browser's normal download mechanism. Nothing is uploaded.
What you do with those files afterwards is up to you.

## The button on the airline's website

QuackPass adds one button to the airline's booking page. It reads nothing from
that page and sends nothing anywhere. Clicking it only opens the extension's own
page.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `cookies` | To read your existing session cookie on ryanair.com, so the airline knows the request is yours |
| `storage` | To keep the offline copy described above, on your computer |
| `downloads` | To save the files you ask for |
| `clipboardWrite` | For the "Copy Image" button |
| Access to `ryanair.com` | The only site QuackPass talks to |

## Children

QuackPass is not directed at children and collects no data from anyone.

## Changes to this policy

If this policy changes, the date at the top changes with it. Because QuackPass
is open source, every change is also visible in its version history.

## Independence

QuackPass is an independent tool. It is not affiliated with, endorsed by,
authorised by, or connected to Ryanair or any other airline. All trademarks
belong to their owners.

## Contact

Questions about this policy: `<CONTACT_EMAIL>`
