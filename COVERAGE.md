# Coverage: what was tested, and how to test the rest

This file is the process for deciding whether the bug report covers enough cases before it is filed.
Every row says what was run, the exact command, and the result. A row marked **open** has no result yet.
Do not file claims about an open row.

Pass criteria for one run: `repro.html` prints less than 3,000 bytes with no text and no non-white pixels
(**BLANK**), and `repro-control.html` prints more than 3,000 bytes with all text. If the control is also
blank, the run is **invalid** (a browser or OS problem, not this bug).

### Controls: why a blank result can be trusted

A blank result only counts if the setup is shown to work. Each CI run has three controls:

| Control | What it rules out | Where |
|---|---|---|
| `repro-control.html` in the same browser | the browser or OS cannot print at all | every run (the `control` column) |
| An empty page in the same browser | the 3,000-byte threshold is wrong for this runner (an empty page prints about 750 to 1,000 bytes, about the same as the blank repro) | every run (the `empty` column); a run is INVALID if the empty page is over the threshold |
| A **known-good build**: Chromium 107.0.5304.18 (Playwright 1.27.1), the last build that printed `repro.html` in a Linux container | the setup, the runner, or the file loading breaks `repro.html` for any Chrome | the `pw-107` target on every OS |
| The **first-bad build**: Chromium 108.0.5359.29 (Playwright 1.28.1) | brackets the Linux window on each runner | the `pw-108` target on every OS |

The `pw-107` row must say `prints` with `repro` and `control` about equal. If it says `BLANK` on a runner, treat every
row for that OS as no data.

**The first known-good choice failed.** Chrome for Testing 127.0.6533.119 headless shell printed `repro.html` on a
physical Mac (`repro=15559 control=15559 empty=751`) but was BLANK on all four GitHub-hosted runners (run
actions/runs/38981978247: `repro=847` against controls of 8,991 to 20,653 bytes). A fresh clone and the same install steps
printed correctly on the Mac, so the difference is the machine and not the repo, the Playwright version, or the
install. The same build blanks in a Linux container. It is now the `cft-127` target: a data point, not a control.

That result is why a control must be a build that is shown to print **on the same kind of machine**. On the Mac,
Chromium 107 and 108 both print. In a Linux container, 107 prints and 108 is blank.

**Result of the corrected controls** (run 39264032665, all 28 jobs succeeded):

- `pw-107` (Chromium 107.0.5304.18) **prints on all four runners**, with `repro` and `control` within 20 bytes
  (Linux 10,604 / 10,619, Windows 21,681 / 21,701, macOS Intel and arm64 16,891 / 16,910). The harness works on every OS.
- `pw-108` (Chromium 108.0.5359.29) is **BLANK on all four** (671 bytes, equal to the empty page).
- The empty-page check passed on every row (under 3,000 bytes: 671 to 887).
- `cft-127` is BLANK on all four again, consistent with the window being 107 to 108 on runners.

## 1. Matrix

| Dimension | Value | Status | Result |
|---|---|---|---|
| OS | macOS 26 (Darwin 25.6), arm64 | done | BLANK |
| OS | Linux Ubuntu 24.04, arm64 (Docker) | done | BLANK (Chromium 133, both headless modes) |
| OS | Linux x86_64 (GitHub `ubuntu-latest`, kernel 6.17 azure) | done, CI | BLANK: Chrome 155.0.8059.84, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (944, 944, 839 bytes; controls 9,072, 9,072, 8,967) |
| OS | Windows (GitHub `windows-latest`, 10.0.26100) x64 | done, CI | BLANK: Chrome 155.0.8059.85, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (954, 954, 839 bytes; controls 20,741, 20,743, 20,626) |
| OS | macOS Intel (GitHub `macos-15-intel`, Darwin 24.6) x64 | done, CI | BLANK: Chrome 155.0.8059.85, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (960, 960, 839 bytes; controls 15,654, 15,656, 15,533) |
| OS | macOS Apple silicon (GitHub `macos-latest`, Darwin 25.6) arm64 | done, CI | BLANK on the same three browsers, same sizes as macOS Intel |
| Platform dependence | Chrome for Testing 127.0.6533.119 headless shell on 4 GitHub runners, a Linux container, and a physical Mac | done | BLANK on the 4 runners and in the container; prints on the physical Mac. Cause unknown. |
| CI version bracket, with control | Chromium 107.0.5304.18 (`pw-107`) and 108.0.5359.29 (`pw-108`) on ubuntu-latest, windows-latest, macos-latest, macos-15-intel | done, CI | 107 prints on all four; 108 BLANK on all four. This is the regression window on every runner. |
| Factors that did **not** change the result | Linux container, Chromium 127: wait 1.5 s, two animation frames, `fonts.ready`, screenshot first, pdf twice, print media, viewport 800x600 / default / 390x844 mobile, device scale factor 2, `file://` URL instead of `setContent`, `LANG`, 1 CPU (`--cpus=1`). Mac, Chrome for Testing 127 shell: `--disable-gpu`, `--disable-software-rasterizer`, SwiftShader, `--enable-unsafe-swiftshader`, and 8 font families. | done | Linux stays BLANK; Mac stays correct |
| Linux version scan (Docker Desktop, Ubuntu 22.04 arm64, Playwright's Chromium) | 107.0.5304.18 prints; 108.0.5359.29, 109, 110, 114, 117, 120, 123, 125, 127.0.6533.17, 128.0.6613.18 blank | done | the Linux regression is between 107 and 108 |
| **Regression range by position, Linux x64** (GitHub `ubuntu-latest`, Chromium snapshots, headless `page.pdf`, run 39272077921) | 1047731 good end, 1058933 bad end | done | **last good r1053680 (`54c0976669f2`), first bad r1053692 (`3af31e148c04`): 12 commits.** One of them is `06876550989f` "Set the LayoutNGPrinting feature to 'stable'." |
| **LayoutNGPrinting feature flag** (Linux container, Playwright's Chromium) | 107 with `--enable-features=LayoutNGPrinting`; 108 and 127 with `--disable-features=LayoutNGPrinting` | done | 108 with the feature disabled **prints** (11,753 bytes; default 671). 107 with it enabled still prints. 127: no effect (still blank). On my physical Mac, 108 prints under every setting (cause unknown). |
| Regression range by position (old headless, Chromium snapshots, macOS arm64) | 1316017 good, 1318290 bad | done, partial | a range of about 2,300 positions. Builds near 1317170 to 1317188 printed nothing here, so it is not one commit. Finish it with `tools/position-bisect.cjs` on a Mac where they run (section 5). |
| Chrome version, old headless (`--headless=old`) | 113.0.5672.63, 116.0.5845.96, 124.0.6367.207, 127.0.6533.119 | done | prints correctly |
| Chrome version, old headless (`--headless=old`) | 128.0.6613.8, 128.0.6613.84 | done | BLANK |
| Chrome version, chrome-headless-shell (Chrome for Testing) | 127.0.6533.119 | done | prints correctly (29,542 bytes, same as the control) |
| Chrome version, chrome-headless-shell (Chrome for Testing) | 128.0.6613.84 | done | BLANK (855 bytes; the control prints 29,542) |
| Chrome version, Playwright's bundled Chromium, **physical Mac only** | 125.0.6422.26, 127.0.6533.17 | done | prints correctly (the same builds are blank on Linux and the CI runners) |
| Chrome version, Playwright's bundled Chromium, physical Mac (133 on Linux) | 128.0.6613.18, 129.0.6668.29, 130.0.6723.31, 133.0.6943.16, 153.0.8010.12, 156.0.8078.4 | done | BLANK |
| Chrome version, new headless | 124.0.6367.207, 127.0.6533.119, 155.0.8059.84, Linux 133 | done | BLANK |
| Chrome version, new headless | 113, 116, 120, 128 | no data | the builds hang or crash on this macOS, even for the control |
| Headless mode | old (`--headless=old`, chrome-headless-shell) and new | done | see the version rows |
| Headed Chrome (a visible window), **raw DevTools `Page.printToPDF`** | 127.0.6533.119, 128.0.6613.84, 155.0.8059.84 | done | prints correctly: 17,480 / 17,480 / 16,886 bytes, all text present. The same Chrome 155 build, file and script blank when headless. **This does not mean headed Chrome is safe**: the print dialog is blank (next row). |
| GPU | `--disable-gpu` and without it (Chrome 155, new headless) | done | BLANK both ways |
| Chrome channel | stable (155) | done | BLANK on Linux, Windows, and both Macs |
| Chrome channel | beta (157.0.8103.6) | done, CI | BLANK on Linux, Windows, and both Macs |
| Chrome channel | dev | no data | `npx playwright install chrome-dev` did not give a usable binary on any of the four runners (launch error: distribution not found). Not a pass. |
| Chrome channel | canary | **open** | not in the workflow |
| Microsoft Edge | stable | partial | print dialog on Windows: not affected (row above). Headless: **open**, CI. |
| `Page.printToPDF` options | Letter, A4 landscape, custom size, `scale`, `printBackground:false`, `preferCSSPageSize`, tagged + outline, `ReturnAsStream` | done | all 8 BLANK |
| Other capture paths | `captureScreenshot` (viewport, full page), print-media emulation + screenshot | done | correct, identical to the control |
| **Print dialog** (Ctrl/Cmd+P, Save as PDF), headed Chrome, macOS | Letter, portrait, margins None, scale Default, background graphics off; page served from `http://localhost:63342` | done, by hand | **BLANK preview for `repro.html`; the control's preview shows all the text.** Chrome 155.0.8059.84, macOS 26.6.1 (25G76). Same from a `file://` URL. **The saved PDF is blank too**: 960 bytes, 1 Letter page, Skia/PDF m155, no text, 0 non-white pixels. Evidence in `results/print-dialog-*`. |
| **Print dialog on Linux, by version** (headed Chromium on Xvfb in Docker, Ubuntu 22.04 arm64, `tools/dialog-linux.sh`) | 107.0.5304.18, 108.0.5359.29, 127.0.6533.17, 156.0.8078.4; 108 with `--disable-features=LayoutNGPrinting`; 108 control | done | **107 shows the text; 108, 127, 156 are blank; 108 with the kill switch shows the text; the control shows the text.** Same boundary and same kill switch as headless `page.pdf`. Screenshots in `results/linux-dialog/`. |
| Print dialog on Windows | Chrome 155.0.8059.84 (printer "Power PDF"), Microsoft Edge 155.0.4283.62 (Save as PDF); `file://` | done, by hand | **NOT affected: both previews show all the text** (`10.3.0`, both UNRELATED lines, the red box). Windows version not recorded; no PDF saved. Differs from the Windows CI headless result (BLANK). Screenshots: `results/print-dialog-windows-*`. |
| Print dialog on older Chrome on macOS | 116, 124, 127 (Chrome for Testing), r1058960 (Chromium snapshot) | no data | on macOS 26.6.1 the snapshot crashes at startup (signal 11) and the Chrome for Testing builds were reported not to render. Use `tools/dialog-linux.sh` instead. |
| **LayoutNGPrinting kill switch, by version** (Linux container, `--disable-features=LayoutNGPrinting`) | 108, 109, 110, 112, 113 fix it; 114, 115, 117, 120, 123, 125, 127, 128 do not (no effect) | done | 111, 116, 118, 119, 121, 122, 124, 126 not tested. The cutoff is between 113 and 114. |
| `LayoutNGPrinting` on 107 | `--enable-features=` and `--enable-blink-features=LayoutNGPrinting` | done | still prints: turning the feature on in 107 does not reproduce it |
| What the print layout trips over | 10 variants of `repro.html`, Chromium 108 and 156 | done | `cqh` in any property in a size container is blank; `@container` queries on it print; one tall page is still blank; `@media print` overrides print. See `README.md`. |
| Firefox | 138.0.1, macOS, WebDriver `printPage` | done | NOT affected: all text printed |
| Safari | 26.6 (21624.4.5.11.5), macOS 26, headed print dialog (File, Print) | done, by hand | NOT affected: the print preview shows `10.3.0`, `UNRELATED-INFLOW-TEXT`, and `UNRELATED-ABS-TEXT` for `repro.html` (from a `file://` URL). Only the preview was checked, not a saved PDF. No screenshot is in the repo (it shows the printer name). |
| Other WebKit browsers | | **open** | not tested |
| `Page.captureSnapshot` (MHTML) | not applicable | skipped | it saves markup and does not render |

## 2. Commands for the rows that are done

Local, one browser (needs `npm install` and `npx playwright install chromium`):

```sh
npm run repro        # repro.html: expect BLANK
npm run control      # repro-control.html: expect "has content"
npm run probe        # every PDF option and the screenshots (needs pdftotext and pdftoppm from poppler)
```

Chrome CLI, a chosen build, a chosen headless mode (`new`, `old`, or `--headless` for chrome-headless-shell):

```sh
"$CHROME" --headless=old --no-pdf-header-footer --print-to-pdf="$PWD/out.pdf" "file://$PWD/repro.html"
pdftotext out.pdf -        # nothing printed means blank
```

Chrome for Testing builds by exact version (the version table above used these):

```sh
npx @puppeteer/browsers install chrome@127.0.6533.119 --path ./cft
npx @puppeteer/browsers install chrome-headless-shell@128.0.6613.84 --path ./cft
```

Linux in a container (arm64 on Apple silicon, x86_64 elsewhere):

```sh
docker run --rm -v "$PWD:/repro:ro" -w /work mcr.microsoft.com/playwright:v1.50.0-noble \
  sh -c "cp /repro/*.html /repro/ci-run.cjs /work/ && npm init -y >/dev/null && npm i playwright@1.50.0 >/dev/null 2>&1 && node ci-run.cjs chromium chromium"
```

Firefox, through the W3C WebDriver "Print Page" command (Selenium downloads Firefox by itself):

```js
const { Builder } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(new firefox.Options().addArguments('-headless')).build();
await driver.get('file:///path/to/repro.html');
const pdfBase64 = await driver.printPage({ background: true, shrinkToFit: false, width: 15.4, height: 9.3, top: 0, bottom: 0, left: 0, right: 0 });
```

## 3. How to cover the open rows

### Windows, Linux x86_64, macOS Intel, and the Chrome channels (CI)

`.github/workflows/matrix.yml` runs `ci-run.cjs` on `ubuntu-latest`, `windows-latest`, `macos-latest` (arm64), and
`macos-15-intel`, for `chromium` (the headless shell) and the `chrome`, `chrome-beta`, and `chrome-dev` channels.
It is `workflow_dispatch` only. Steps:

1. Push the repo (the workflow file is already in it).
2. Actions tab, "print-to-pdf matrix", "Run workflow".
3. Open the run summary. Each job appends one row: OS, target, version, repro bytes, control bytes, result.
4. Copy the rows into the results table in `README.md`. Any row that says `ERROR` or `INVALID` is a missing
   data point, not a pass.

To add Edge, add `msedge` to the `target` list. To test an exact Chrome build on CI, use
`browser-actions/setup-chrome` with `chrome-version: <full version>` and run the CLI command from section 2.

### Print from the Chrome UI (Ctrl/Cmd+P)

**Result so far (Chrome 155.0.8059.84, macOS 26.6.1, by hand):** the preview is **blank for `repro.html`** and shows all
the text for `repro-control.html`, from a `file://` URL and from `http://localhost:63342`. The saved PDF is blank too
(960 bytes, 1 Letter page, no text, 0 non-white pixels). So the bug is not headless-only. A DevTools `Page.printToPDF`
in a headed window printed correctly, so the dialog path and that call differ.

**Linux, by version (done, automated):** `tools/dialog-linux.sh <playwright-version> <repro|repro-control>` runs a headed
Chromium on a virtual display in Docker, presses Ctrl+P, and screenshots the dialog into `results/linux-dialog/`. The dialog
shows the text on Chromium 107.0.5304.18 and is blank on 108.0.5359.29, 127.0.6533.17, and 156.0.8078.4, the same boundary as
headless `page.pdf`. Use it for any other Playwright version (1.27.1 is Chromium 107, 1.28.1 is 108, 1.45.2 is 127). It does
not depend on your macOS.

Still missing:

- The print dialog on Windows with an older Chrome, and a saved PDF there.
- The print dialog on older Chrome on macOS. Old builds do not work reliably on macOS 26 (a Chromium snapshot near 108 crashed
  at startup; Chrome for Testing 116, 124, and 127 were reported not to render), so that row is "no data". The Docker route
  above covers the versions.

**Trying an older Chrome on macOS, without touching your normal one** (works only for builds that start on your macOS)

```sh
tools/run-chrome.sh 127.0.6533.119     # a Chrome for Testing build, versions 113 and later
tools/run-chrome.sh r1047731           # an older Chromium snapshot, by main-branch position (107 branch point)
tools/run-chrome.sh r1058933           # 108 branch point
```

It downloads the build into `~/.cache/chrome-test-builds` (set `CHROME_BUILDS_DIR` to change it), opens it as a separate
app with a new throwaway profile, and loads `repro.html` and `repro-control.html`. Your installed Chrome, its profile,
its extensions and its default-browser setting are not used or changed. Delete the folder to remove the builds.
Check the exact version in `chrome://version` and note it. Builds from some Chrome versions do not start on a given
macOS (Chrome for Testing 120 crashed here); record that as "no data" and try a neighbouring version.

Suggested order, to find the boundary quickly: 155 (known blank), 127.0.6533.119, 124.0.6367.207, 116.0.5845.96,
then `r1058933`, `r1047731`, narrowing between the last blank and the first correct one.

The steps, for repeating it on another system:

1. Open `repro.html` in Chrome. Confirm "10.3.0" and the two UNRELATED lines show on screen.
2. Press Ctrl+P (Cmd+P on macOS). Set **Destination** to **Save as PDF**. Turn on **Background graphics**.
   Record whether the preview pane is blank.
3. Save the file. Run `pdftotext file.pdf -`. Record whether text is present.
4. Repeat with `repro-control.html`.
5. Record the Chrome version from `chrome://version`, the OS, and the paper size you chose.

### Safari (macOS) and other WebKit

Safari WebDriver needs `sudo safaridriver --enable`, so the steps are manual.

1. Open `repro.html` in Safari. Choose **File, Print...** (Cmd+P), then **PDF, Save as PDF** at the bottom left.
2. Run `pdftotext` on the saved file. Record whether text is present.
3. Repeat with `repro-control.html`. Record the Safari version (Safari menu, About Safari).

### Firefox on other operating systems

Run the Firefox snippet above on Windows and Linux, or use **File, Print, Save to PDF** by hand. It is only
needed if the report should say "Firefox is not affected" for those systems.

## 4. When the report is ready

- Every row in the matrix is `done`, `no data` with a reason, or `skipped` with a reason.
- The results table in `README.md` and the "Additional information" in `ISSUE.md` use only these rows.
- The regression window in `ISSUE.md` is the narrowest one in the version rows.
- Attachments for the tracker: `repro.html`, `repro-control.html`, and the PDFs in `results/`.

## 5. Finishing the position bisect

**Linux x64: done (12 commits).** `.github/workflows/bisect-linux.yml` runs `tools/position-bisect.cjs` on a GitHub Ubuntu
runner. It first checks that a build near each end behaves as expected (it fails loudly if not), then bisects Chromium
snapshot builds. Run 39272077921 found last good r1053680 and first bad r1053692 in about 90 seconds. To repeat or move
the range, run the workflow by hand from the Actions tab and set `good_pos` and `bad_pos`. The job summary has the commit
hashes, the changelog link, and every probe.

**My physical Mac, a different boundary: partial.** On that Mac, old headless prints until Chrome 128, a range of 2,300
positions: 1316017 (last good) to 1318290 (first bad):
https://chromium.googlesource.com/chromium/src/+log/57d31eae8e4eca52fc106402dec56d772755221c..e32ab6f1f764b726a16f7220e9fd6c0be9996491
Snapshot builds around 1317170 to 1317188 printed nothing on macOS 26 arm64 (even for the control), so it stopped there.
To finish it, run the same script on a Mac:

```sh
cd tools && npm install
SNAPSHOT_PLATFORM=Mac_Arm GOOD_POS=1316017 BAD_POS=1318290 node position-bisect.cjs   # Mac on Intel: SNAPSHOT_PLATFORM=Mac
```

It tries neighbouring snapshots when one does not run, but needs builds that start. Why this Mac differs from every
other machine (it prints on 108 through 127) is not known.

**Not bisected:** new headless, and the print dialog. The dialog's regression window may differ from headless `page.pdf`.
Use `tools/run-chrome.sh` (section 3) to find it by hand.
