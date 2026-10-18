# FrameFit

A static, browser-local photo resizer and compressor. No runtime dependencies, external fonts, analytics, backend, or photo uploads.

## Use

Serve the `dist/` directory through a static HTTP host. Choose or drop a JPEG, PNG or WebP image, select an application preset or custom dimensions, adjust framing, and export. The app also accepts pasted images and typed requests such as `600 x 600 px under 200 KB`, `35 x 45 mm at 300 DPI`, and `India visa under 200 KB`.

## Behaviour

- Seven application-specific presets across six countries, with official links and a source-check date. Requirements are fixed data, not automatically refreshed.
- Custom px/mm/cm/in dimensions, density conversion, aspect lock, cover/contain fitting, zoom, drag and keyboard positioning, and 90-degree rotation.
- Browser Canvas encoding, quality search for a target byte limit, JPG/PNG/WebP output, real encoded previews, original-to-result file-size comparison, and downloads.
- Downloads use a persistent user-clicked link instead of a synthetic click on a temporary element. In supported top-level browsers, the main action opens a native Save As dialog and confirms success only after writing and closing the file. Direct-download and open-image links remain available when a dialog or download is restricted; cancelled saves do not trigger an unsolicited fallback download.
- Exact output dimensions never change silently to meet a file limit. Unreachable targets, low-resolution enlargement, and preset minimum/maximum violations are explained before download.
- Print density embedded in JPEG JFIF and PNG pHYs metadata; WebP exports do not embed density.
- A 50 MB source-file limit, 40 MP decoded-source limit, and 6,000 px per edge / 24 MP output limit guard memory use. Oversized originals must be resized before compression-only export.
- Source EXIF metadata is not copied. Native browser decoding handles EXIF orientation.
- No facial retouching, automatic background removal, biometric analysis, or acceptance certification. Preview guides are approximate manual aids.

## Checks

`node --check dist/app.js` and `node --check dist/core.js` check JavaScript syntax. `npm test` exercises the parser, crop geometry, actual image rendering, rotation, alpha handling, JPEG compression, print metadata, and application wiring. Test-only image dependencies are `@napi-rs/canvas` and `sharp`; install them locally or provide an existing installation through `CODEX_PRIMARY_RUNTIME_NODE_MODULES`.

Browser interaction and visual QA require a supported browser-control environment and were not available during this build.
