# Chrome prints a blank PDF: `cqh` inside `container-type: size`

`Page.printToPDF` returns a PDF with no content for `repro.html`. The page renders correctly on screen.
`repro-control.html` is the same page with a fixed font size instead of `13cqh`. It prints correctly.

## Reproduce

No dependencies (headless Chrome CLI):

```sh
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"   # adjust for your OS
"$CH" --headless --no-pdf-header-footer --print-to-pdf="$PWD/out.pdf" "file://$PWD/repro.html"
pdftotext out.pdf -    # prints nothing; the PDF is about 970 bytes
```

Control:

```sh
"$CH" --headless --no-pdf-header-footer --print-to-pdf="$PWD/out-control.pdf" "file://$PWD/repro-control.html"
pdftotext out-control.pdf -    # prints 10.3.0; the PDF is about 7 KB
```

With Playwright (`page.pdf()` calls `Page.printToPDF`). The script also prints the on-screen font size,
so you can see the text is visible on screen:

```sh
npm install && npx playwright install chromium
npm run repro      # screen: font-size 22.88px ... BLANK
npm run control    # screen: font-size 22.88px ... has content
```

## Results (run 2026-10-16, macOS, arm64, 3 runs each, identical every run)

| Browser | `repro.html` | `repro-control.html` |
|---|---|---|
| Google Chrome 155.0.8059.84 (CLI `--print-to-pdf`) | 968 bytes, no text | 7,306 bytes, text `10.3.0` |
| Google Chrome 155.0.8059.84 (Playwright `page.pdf`) | 960 bytes | 6,473 bytes |
| Chromium headless shell 153.0.8010.12 (Playwright `page.pdf`) | 839 bytes | 6,352 bytes |
| Chromium headless shell 156.0.8078.4 (Playwright `page.pdf`) | 839 bytes | 6,352 bytes |

## What triggers it

One change at a time from `repro.html`, same result in both Chrome builds:

| Change | PDF |
|---|---|
| none (as written) | blank |
| fixed `22.88px` font, `container-type: size` kept | has content |
| `cqh` replaced by `cqw` | has content |
| `cqh` replaced by `cqb` or `cqmin` | blank |
| `container-type: inline-size` or `contain: size` instead | has content (`cqh` then resolves against the viewport, so the font size differs) |
| remove the `position: relative` ancestor | has content |
| remove `position: absolute` from the box | has content |
| box height `100px` or `400px` instead of `176px` | blank |

So the page needs a block-axis container unit (`cqh`, `cqb`, `cqmin`) inside a `container-type: size` element,
and an absolutely positioned box inside a `position: relative` ancestor. The blank appears to cover the whole page,
not only the `cqh` text: in an earlier, larger version of this page (and in the full app), unrelated text on the
same page also disappeared. I did not re-check that with `repro.html` itself.

The flex wrapper and `flex-grow` div are there so that `height: 100%` resolves on screen. Without them the
container is 0px tall and the text is invisible on screen too. That is expected, not this bug. I did not check
whether other ways of getting a definite height also trigger it.

## Not tested

- Firefox and Safari.
- Printing from the browser UI. Only `Page.printToPDF` was tested.
- Other Chrome versions and operating systems.
- Why it happens. This is a report of the behavior, not a diagnosis.

## Origin

A dashboard app uses `container-type: size` with `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` on a KPI
tile. Its grid items are absolutely positioned. PDF exports of dashboards with that tile came out blank.
`repro.html` came from an automated reduction of the real page (about 200 KB of DOM and CSS down to 15 elements),
then a hand reduction. The app now avoids the problem by computing the font size in JavaScript for PDF exports.
