# Headless Chrome prints a blank PDF: `cqh` inside `container-type: size`

In **headless** Chrome, `Page.printToPDF` returns a PDF with no content at all for `repro.html`: no text,
no background colors, and no unrelated elements. The page renders correctly on screen and in screenshots.
**Headed** Chrome prints the same file correctly, and so does Firefox.
`repro-control.html` is the same page with a fixed font size instead of `13cqh`. It prints correctly.

`COVERAGE.md` lists every case that was tested, every case that was not, and how to run the rest.

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

Files in `results/`: the blank and the correct PDFs from Chrome 155, the correct PDFs from Firefox 138, and a
screenshot of the page as Chrome shows it.

## Results (2026-10-16; the Playwright runs are 3 runs each, identical every run)

| Browser | OS | `repro.html` | `repro-control.html` |
|---|---|---|---|
| Google Chrome 155.0.8059.84, new headless, CLI `--print-to-pdf` | macOS 26, arm64 | 968 bytes, no text | 16,891 bytes, all text present |
| Google Chrome 155.0.8059.84, new headless, Playwright `page.pdf` | macOS 26, arm64 | 960 bytes | 15,654 bytes |
| Chromium headless shell 156.0.8078.4, Playwright `page.pdf` | macOS 26, arm64 | 839 bytes | 15,533 bytes |
| Chromium headless shell 133.0.6943.16, Playwright `page.pdf` | Ubuntu 24.04, arm64 (Docker) | 856 bytes | 8,983 bytes |
| **Google Chrome 155.0.8059.84, headed, raw DevTools `Page.printToPDF`** | macOS 26, arm64 | **16,886 bytes, all text** | 16,886 bytes |
| Firefox 138.0.1, WebDriver `printPage` | macOS 26, arm64 | 12,624 bytes, all text | 12,625 bytes |

The same Chrome 155 build, file, and script give 16,886 bytes headed and 974 bytes headless. Disabling the GPU
makes no difference (the CLI with and without `--disable-gpu` is blank).

## When it started

Measured with the `Page.printToPDF` command line on macOS 26 arm64. The page text was shorter in the earlier
runs than in the final `repro.html`; the unrelated text was moved only to stop overlaps, and the result did not
change on re-runs with the final file in Chrome 155, Chromium 156, and Chromium 133.

| Build | Old headless / headless shell | New headless |
|---|---|---|
| Chrome 113.0.5672.63, 116.0.5845.96, 124.0.6367.207, 127.0.6533.119 | **prints correctly** | 124 and 127 blank; 113 and 116 did not run here |
| Chrome 128.0.6613.8, 128.0.6613.84 | **blank** | did not run here (the build hangs, also for the control) |
| Chromium 129 to 156 | **blank** | blank (155, and Linux 133) |

So in old headless mode and in chrome-headless-shell the bug first appears in Chrome 128. New headless mode is
blank in the oldest build that runs here (124). Headed Chrome printed correctly on 127, 128, and 155.
`BISECT_RESULT_PLACEHOLDER`

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
| `page.screenshot()` | correct | identical |
| `page.screenshot({ fullPage: true })` | correct | identical |
| `emulateMedia({ media: 'print' })` then `page.screenshot()` | correct | identical |

The print-media screenshot matches the screen screenshot pixel for pixel. Switching to print CSS does not cause the
blank. Only the headless PDF output path does. The font size under print media emulation is still `22.88px`.

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

See `COVERAGE.md` for the full list and the steps. At the time of writing:

- Windows, Linux x86_64, macOS Intel, Chrome beta/dev/canary, and Edge (needs the CI workflow in this repo).
- Printing from the browser UI (Ctrl/Cmd+P). Headed `Page.printToPDF` is not affected.
- Safari and other WebKit browsers.
- Why it happens. This is a report of the behavior, not a diagnosis.

## Origin

A dashboard app uses `container-type: size` with `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` on a KPI
tile. Its grid items are absolutely positioned. PDF exports from a headless Chrome came out blank, including
the other tiles on the page. `repro.html` came from an automated reduction of the real page (about 200 KB of DOM and
CSS down to 15 elements), then a hand reduction. The app now avoids the problem by not using `cqh` or
`container-type: size` for that tile.
