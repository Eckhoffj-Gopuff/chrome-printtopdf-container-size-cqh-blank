# Chrome prints a blank PDF: `cqh` inside `container-type: size`

`Page.printToPDF` returns a PDF with no content at all for `repro.html`: no text, no background colors, and no
unrelated elements. The page renders correctly on screen and in screenshots.
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
pdftotext out-control.pdf -    # prints 10.3.0 and both UNRELATED texts; the PDF is about 17 KB
```

With Playwright (`page.pdf()` calls `Page.printToPDF`). The script also prints the on-screen font size,
so you can see the text is visible on screen:

```sh
npm install && npx playwright install chromium
npm run repro      # screen: font-size 22.88px ... BLANK
npm run control    # screen: font-size 22.88px ... has content
```

## Results (run 2026-10-16, macOS, arm64; the Playwright runs are 3 runs each, identical every run)

| Browser | `repro.html` | `repro-control.html` |
|---|---|---|
| Google Chrome 155.0.8059.84 (CLI `--print-to-pdf`) | 968 bytes, no text | 16,889 bytes, all text present |
| Google Chrome 155.0.8059.84 (Playwright `page.pdf`) | 960 bytes | 15,653 bytes |
| Chromium headless shell 156.0.8078.4 (Playwright `page.pdf`) | 839 bytes | 15,532 bytes |

Chromium headless shell 153.0.8010.12 also produced the blank (839 bytes) with an earlier version of this page that
did not have the unrelated content. I did not re-run 153 on the current files.

## The whole page is blank, not only the `cqh` text

`repro.html` contains three things that do not use container query units: an in-flow paragraph, a red box, and
an absolutely positioned paragraph. `probe-render-paths.cjs` checks the first PDF page with `pdftotext` and
`pdftoppm` (50 dpi). For `repro.html` it finds none of the text, no red pixels, and 0 non-white pixels, in
every option variant below. For `repro-control.html` it finds all of them.

## Other render paths

From `probe-render-paths.cjs` (needs `pdftotext` and `pdftoppm`). Same result in Google Chrome 155 and Chromium 156.

| Path | `repro.html` | `repro-control.html` |
|---|---|---|
| `page.pdf` 583x350 px, Letter, A4 landscape, `scale: 0.5`, `printBackground: false`, `preferCSSPageSize` with `@page`, `tagged` + `outline` | blank (0 non-white pixels) | content |
| Raw CDP `Page.printToPDF` with `transferMode: ReturnAsStream` | blank | content |
| `page.screenshot()` | correct, 7,151 non-white pixels | identical |
| `page.screenshot({ fullPage: true })` | correct | identical |
| `emulateMedia({ media: 'print' })` then `page.screenshot()` | correct | identical |

The print-media screenshot matches the screen screenshot pixel for pixel. Switching to print CSS does not cause the
blank. Only the PDF output path does. The font size under print media emulation is still `22.88px`.

## What triggers it

One change at a time from `repro.html`, same result in both Chrome builds. These were measured on the earlier
version of the page, before the unrelated content was added, using PDF size as the signal (blank is about 850 to 1,000
bytes; content is about 6 KB):

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
and an absolutely positioned box inside a `position: relative` ancestor.

The flex wrapper and `flex-grow` div are there so that `height: 100%` resolves on screen. Without them the
container is 0px tall and the text is invisible on screen too. That is expected, not this bug. I did not check
whether other ways of getting a definite height also trigger it.

## Not tested

- Firefox and Safari.
- Printing from the browser UI (`window.print()` or the print dialog). Only `Page.printToPDF` was tested.
- `Page.captureSnapshot` (MHTML). It does not render, so it would not show this.
- Other Chrome versions and operating systems.
- Why it happens. This is a report of the behavior, not a diagnosis.

## Origin

A dashboard app uses `container-type: size` with `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` on a KPI
tile. Its grid items are absolutely positioned. PDF exports of dashboards with that tile came out blank, including
the other tiles on the page. `repro.html` came from an automated reduction of the real page (about 200 KB of DOM and
CSS down to 15 elements), then a hand reduction. The app now avoids the problem by computing the font size in
JavaScript for PDF exports.
