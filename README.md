# Chrome prints a blank page: `cqh` inside `container-type: size`

Chrome prints nothing for `repro.html`: no text, no background colors, and no unrelated elements. This happens in
**headless** Chrome (`Page.printToPDF`) and in the **headed Chrome print dialog** (Ctrl/Cmd+P, the preview is blank).
The page renders correctly on screen and in screenshots. Firefox prints it correctly.
`repro-control.html` is the same page with a fixed font size instead of `13cqh`. It prints correctly everywhere.

A DevTools `Page.printToPDF` call in a headed Chrome window printed `repro.html` correctly in my tests (Chrome 155,
127, 128 on macOS), while the print dialog did not. Why those two headed paths differ is not known.

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
| Google Chrome 155.0.8059.85, Playwright `page.pdf` (GitHub Actions) | Ubuntu (kernel 6.17), x64 | 944 bytes | 9,072 bytes |
| Google Chrome beta 157.0.8103.6, Playwright `page.pdf` (GitHub Actions) | Ubuntu (kernel 6.17), x64 | 944 bytes | 9,072 bytes |
| Chromium headless shell 156.0.8078.4, Playwright `page.pdf` (GitHub Actions) | Ubuntu (kernel 6.17), x64 | 839 bytes | 8,967 bytes |
| Google Chrome 155.0.8059.85, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (GitHub Actions) | Windows 10.0.26100, x64 | 954 / 954 / 839 bytes | 20,741 / 20,743 / 20,626 bytes |
| Google Chrome 155.0.8059.85, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (GitHub Actions) | macOS 15, x64 (Intel) | 960 / 960 / 839 bytes | 15,654 / 15,656 / 15,533 bytes |
| Google Chrome 155.0.8059.85, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (GitHub Actions) | macOS, arm64 | 960 / 960 / 839 bytes | 15,654 / 15,656 / 15,533 bytes |
| Google Chrome 155.0.8059.84, headed, raw DevTools `Page.printToPDF` | macOS 26, arm64 | 16,886 bytes, all text (**not** blank) | 16,886 bytes |
| **Google Chrome 155.0.8059.84, headed, print dialog (Ctrl/Cmd+P, Save as PDF, Letter, portrait)** | macOS 26.6.1 (25G76); opened from `http://localhost:63342` and from a `file://` URL, same result | **blank preview; the saved PDF is blank** (960 bytes, 1 Letter page, no text, 0 non-white pixels) | preview shows all the text |
| Firefox 138.0.1, WebDriver `printPage` | macOS 26, arm64 | 12,624 bytes, all text | 12,625 bytes |
| Safari 26.6 (21624.4.5.11.5), print dialog preview | macOS 26 | **all text shown (not affected)** | not checked |

The same Chrome 155 build, file, and script give 16,886 bytes for a DevTools `Page.printToPDF` in a headed window
and 974 bytes headless. The print dialog in a headed Chrome is blank for `repro.html`, so a headed window is **not**
a safe path: only the DevTools call printed correctly. Disabling the GPU makes no difference (the CLI with and
without `--disable-gpu` is blank).

## When it started

**The regression is between Chromium 107 and 108 on every machine except my physical Mac.** On all four
GitHub-hosted runners (Ubuntu x64, Windows x64, macOS 15 Intel, macOS arm64) Chromium 107.0.5304.18 prints
`repro.html` correctly and Chromium 108.0.5359.29 prints it blank (run 39264032665, table below). The same holds in
a Linux container. On my **physical Mac** old headless prints correctly until Chrome 128. I do not know why the Mac
differs. Not the cause (all tested, see `COVERAGE.md`): CPU count, timing, viewport, device scale factor, locale,
page lifecycle, fonts, and GPU-related flags.

**GitHub-hosted runners, Playwright's bundled Chromium (`page.pdf`), run 39264032665:**

| Runner | Chromium 107.0.5304.18 (known-good control) | Chromium 108.0.5359.29 | Empty page |
|---|---|---|---|
| Ubuntu x64 | **prints**: repro 10,604, control 10,619 | **blank**: repro 671, control 10,606 | 887 / 671 |
| Windows x64 (10.0.26100) | **prints**: repro 21,681, control 21,701 | **blank**: repro 671, control 21,688 | 887 / 671 |
| macOS 15 Intel | **prints**: repro 16,891, control 16,910 | **blank**: repro 671, control 16,897 | 887 / 671 |
| macOS arm64 | **prints**: repro 16,891, control 16,910 | **blank**: repro 671, control 16,897 | 887 / 671 |

A blank `repro.html` is 671 bytes, the same as an empty page in that build. The 107 control prints on every runner,
so the harness works and the blank results are not a setup problem. Chrome for Testing 127.0.6533.119 headless shell is
also blank on all four runners (847 bytes), as expected for a build after 108.

The page text was shorter in the earlier runs than in the final `repro.html`; the unrelated text was moved only to
stop overlaps. The result did not change on re-runs with the final file.

**Linux container** (Ubuntu 22.04, arm64, Docker Desktop VM; Playwright's bundled Chromium, `page.pdf`):

| Chromium | `repro.html` | `repro-control.html` |
|---|---|---|
| 107.0.5304.18 | **prints correctly** (11,765 bytes) | 11,779 |
| 108.0.5359.29 | **blank** (671 bytes) | 11,767 |
| 109, 110, 114, 117, 120, 123, 125, 127.0.6533.17, 128.0.6613.18 | blank | prints |

So on Linux the bug is in every build from Chromium 108 on, and Chromium 107 is the last good one I found. An empty
page prints 666 to 887 bytes, and a blank `repro.html` is within 100 bytes of the empty page in the same build.

**Linux x64 position bisect (GitHub Actions run 39272077921, Chromium snapshot builds, headless `page.pdf`):** the last
build that prints is position **1053680** (`54c0976669f2`, 108.0.5333.0); the first that blanks is **1053692**
(`3af31e148c04`). The 12 commits in between:
https://chromium.googlesource.com/chromium/src/+log/54c0976669f28779ae1f9c0d7e66c7657c49469e..3af31e148c049854a63e6e831aca5862ac98fd09
One of them is `06876550989f`, "Set the LayoutNGPrinting feature to 'stable'." (2022-09-30). The rest are unrelated rolls and
UI changes. The workflow is `.github/workflows/bisect-linux.yml` and the script is `tools/position-bisect.cjs`; it first checks
that the two ends behave as expected, then bisects (it took about 90 seconds).

**The feature flag confirms it** (Linux container, Playwright's Chromium, headless `page.pdf`):

| Chromium | Arguments | `repro.html` | `repro-control.html` |
|---|---|---|---|
| 107.0.5304.18 | none | 11,765 (prints) | 11,779 |
| 107.0.5304.18 | `--enable-features=LayoutNGPrinting` | 11,765 (still prints) | 11,779 |
| 107.0.5304.18 | `--enable-blink-features=LayoutNGPrinting` (the runtime feature) | 11,765 (still prints) | 11,779 |
| 108.0.5359.29 | none | **671 (blank)** | 11,767 |
| 108.0.5359.29 | `--disable-features=LayoutNGPrinting` | **11,753 (prints)** | 11,767 |
| 109.0.5414.46, 110.0.5481.38 | none / `--disable-features=LayoutNGPrinting` | 671 (blank) / **11,753 (prints)** | 11,767 |
| 112.0.5615.29 | none / `--disable-features=LayoutNGPrinting` | 671 (blank) / **11,570 (prints)** | 11,841 / 11,585 |
| 114.0.5735.35 | none, and `--disable-features=LayoutNGPrinting` | 672 (blank both) | 11,842 |
| 127.0.6533.17 | none, and `--disable-features=LayoutNGPrinting` | 847 (blank both) | 10,233 |

The change in the bisect range is `06876550989f` "Set the LayoutNGPrinting feature to 'stable'." (Bug: 1121942, commit position
#1053686). It turns the existing LayoutNG print code on by default and adds a base feature as a kill switch. So the blank comes
from the LayoutNG print layout that became the default in Chrome 108. The kill switch works on 108 to 112 and has no effect by
114 (113 prints with it: 11,570 against 671 by default; 115, 117, 120, 123, 125, and 128 are blank with or without it). Turning the feature on in 107, by either switch, did not reproduce it, so it may depend on other changes.
I did not diagnose the defect. On my physical Mac, Chromium 108 prints under every setting of this flag, which I cannot explain.

**What the print layout trips over** (Linux container; identical results on Chromium 108.0.5359.29 and 156.0.8078.4; headless
`page.pdf`). One change at a time from `repro.html`:

| Change | Result |
|---|---|
| none (`13cqh` font size, `container-type: size`) | blank |
| one very tall page (583x6000 px), so nothing is split across pages | blank |
| fixed font size, but `height: 13cqh` on the text block | blank |
| fixed font size, but `width: 10cqh` on the text block | blank |
| fixed font size, plus `@container (min-height: 1px) { … }` | prints |
| fixed font size, plus a non-matching `@container (min-height: 9999px) { … }` | prints |
| `@media print { .container { container-type: normal } .text { font-size: 22.88px } }` | prints |
| `@media print { .text { font-size: 22.88px } }`, `container-type: size` kept | prints |
| `@media print { .container { container-type: inline-size } }`, `cqh` kept | prints |
| `@media print { .container { container-type: normal } }`, `cqh` kept | prints |

So it is the block-axis container query **unit** (`cqh`), used in any property, inside a `container-type: size` element.
Container **queries** on the same element print correctly. It is not about splitting across pages (the tall page is blank
too). A print-only CSS override avoids it, which also shows `@media print` rules apply in this path.

**The print dialog on Linux** (headed Chromium on a virtual display in Docker; `tools/dialog-linux.sh`; screenshots in
`results/linux-dialog/`): the preview for `repro.html` shows the text on Chromium **107.0.5304.18** (the `10.3.0` is much larger
than on screen, so `cqh` did not resolve against the container there; I did not check what it resolved against) and is **blank** on **108.0.5359.29**, **127.0.6533.17**, and
**156.0.8078.4**. `repro-control.html` shows all the text on 108. Chromium 108 with `--disable-features=LayoutNGPrinting` shows
the text again. So the print dialog and `page.pdf` fail on the same builds, and the same kill switch fixes both.

**macOS 26 arm64, physical machine** (`Page.printToPDF` command line):

| Build | Old headless / headless shell | New headless |
|---|---|---|
| Chrome 113.0.5672.63, 116.0.5845.96, 124.0.6367.207, 127.0.6533.119 | **prints correctly** | 124 and 127 blank; 113 and 116 did not run here |
| Chromium 107.0.5304.18 and 108.0.5359.29 (Playwright) | prints correctly | not run |
| Chrome 128.0.6613.8, 128.0.6613.84 | **blank** | did not run here (the build hangs, also for the control) |
| Chromium 129 to 156 | **blank** | blank (155, and Linux 133) |

So on this Mac, old headless and chrome-headless-shell first fail in Chrome 128, and new headless is blank in the
oldest build that runs here (124). A DevTools `Page.printToPDF` in a headed window printed correctly on 127, 128,
and 155, but that is not the print dialog, which is blank in Chrome 155.0.8059.84. On macOS the dialog could not be tried on
older builds (they crash or do not render on macOS 26). The Linux dialog results above cover the versions.

**Position bisect (macOS 26 arm64 physical machine, old headless, `--headless=old`, Chromium snapshot builds):** the last build that
prints correctly is position 1316017 (`57d31eae8e4e`, both files 29,540 bytes). The first build that blanks is
position 1318290 (`e32ab6f1f764`, `repro.html` 855 bytes, control 29,542). The regression is in this range of about
2,300 positions:
https://chromium.googlesource.com/chromium/src/+log/57d31eae8e4eca52fc106402dec56d772755221c..e32ab6f1f764b726a16f7220e9fd6c0be9996491

It is a range, not one commit. Many snapshot builds between the two (for example 1317170 to 1317188 and 1316032
to 1316043) printed nothing on my machine, even for the control, so the search could not go further here.
Someone with a Mac where those builds run can finish it with `tools/position-bisect.cjs` (see `COVERAGE.md`, section 5).

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

- Chrome dev and canary channels (the dev install did not work on any CI runner), and Microsoft Edge.
- Windows, Linux, and macOS runners were tested only in headless mode, with Playwright's `chromium`, the `chrome` and
  `chrome-beta` channels, Chrome for Testing 127, and Chromium 107 and 108. Headed Chrome was tested only on my Mac.
- The cause inside LayoutNG printing. The Linux bisect gives a 12-commit range and a feature flag that fixes 108, but
  not the defect itself. The bisect covers old headless on Linux x64, not new headless or the print dialog.
- The print dialog was tested by hand in Chrome 155.0.8059.84 on macOS 26.6.1, and by script on Linux (Chromium 107,
  108, 127, 156). The Windows dialog and older Chrome in the macOS dialog are untested.
- WebKit browsers other than Safari 26.6 on macOS, and Safari on other systems.
- Why it happens. This is a report of the behavior, not a diagnosis.

## Origin

A dashboard app uses `container-type: size` with `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` on a KPI
tile. Its grid items are absolutely positioned. PDF exports from a headless Chrome came out blank, including
the other tiles on the page. `repro.html` came from an automated reduction of the real page (about 200 KB of DOM and
CSS down to 15 elements), then a hand reduction. The app now avoids the problem by not using `cqh` or
`container-type: size` for that tile.
