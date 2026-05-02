# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Fork-Specific Context

This is a private fork of Mozilla PDF.js, published as **`@hardroller/pdfjs-dist`** to a private npm registry at `https://npm.hardroller.ru`.

### Publishing

```bash
npx gulp dist        # Build the distribution package
npm publish          # From build/dist/ — publishes to the private registry
```

The `publishConfig.registry` is set to `https://npm.hardroller.ru` in `gulpfile.mjs`. The package name is set via `DIST_NAME = "@hardroller/pdfjs-dist"`.

### Running a Single Unit Test

```bash
# Pass a grep pattern to Jasmine
npx jasmine --filter="<test name pattern>" test/unit/<file>_spec.js
```

### Fork-Specific Features

#### TrueType Font Embedding for Free Text Annotations

When saving free text annotations, the fork embeds **LiberationSans-Regular** as a TrueType font in the PDF output. This enables non-Latin character support in saved annotations.

Key files:
- `src/core/truetype_font_embedder.js` — builds the composite Type0/CIDFontType2 font structure
- `src/core/annotation.js` — calls `embedTrueTypeFont()` before creating `FreeTextAnnotation` objects
- `src/core/xref.js` — adds `putTemporaryRefToCache()` to make temporary font refs resolvable during the same save pass

The font embedding requires a binary CIDToGIDMap file. The `cidToGidMapUrl` option (in `web/app_options.js`) points to the directory containing these `.bin` files:
- Dev default: `../external/cid_to_gid_maps/`
- The pre-generated map for LiberationSans-Regular is in `external/font_embedding/LiberationSans-Regular_CidToGIDMap.bin`

You must copy or symlink the `.bin` file into the `external/cid_to_gid_maps/` directory before using the dev server with free text annotations.

#### Font Embedding Utilities (`external/font_embedding/`)

Python scripts using `fontTools` to regenerate data for new fonts:
- `CIDToGIDMap.py` — generates a binary CIDToGIDMap from a `.ttf` file
- `WidthAndDefaultWidth.py` — generates the `W` (glyph widths) and `DW` (default width) arrays for a font

The generated JS data files live in `src/core/` (e.g., `LiberationSans-Regular_W.js`).

#### Axis Locking in Drawing Editors

In both the ink drawing and free highlighter annotation editors:
- **Shift** locks movement to the X axis
- **Ctrl** locks movement to the Y axis

Implemented in `src/display/editor/drawers/inkdraw.js` and `src/display/editor/drawers/freedraw.js`.

#### Dev Server: `useSystemFonts` Disabled

The dev server (`npx gulp server`) sets `useSystemFonts: false` so that the embedded LiberationSans font is always used, matching the saved PDF output.

---

## Annotation System In Depth

### Annotation Types (`src/core/annotation.js`)

`AnnotationFactory` dispatches to subclasses based on the PDF `/Subtype` key:

```
Annotation (base)
├── MarkupAnnotation
│   ├── TextAnnotation         — sticky notes
│   ├── FreeTextAnnotation     — text boxes (uses font embedding in this fork)
│   ├── LineAnnotation
│   ├── SquareAnnotation       — rectangle with border/fill
│   ├── CircleAnnotation
│   ├── PolylineAnnotation
│   ├── PolygonAnnotation
│   ├── InkAnnotation          — freehand strokes
│   ├── HighlightAnnotation    — highlight markup (quad-points based)
│   ├── UnderlineAnnotation
│   ├── SquigglyAnnotation
│   ├── StrikeOutAnnotation
│   ├── FileAttachmentAnnotation
│   ├── CaretAnnotation
│   └── StampAnnotation
├── WidgetAnnotation           — interactive form fields
│   ├── TextWidgetAnnotation
│   ├── ButtonWidgetAnnotation
│   ├── ChoiceWidgetAnnotation
│   └── SignatureWidgetAnnotation
├── LinkAnnotation
└── PopupAnnotation
```

`SquareAnnotation` is the PDF-native type for a rectangle with a border color and optional fill — the closest fit for bordered rectangle highlights.

### `AnnotationEditorType` values (`src/shared/util.js`)

These numeric constants identify which editor mode is active:

| Name | Value | Description |
|------|-------|-------------|
| DISABLE | -1 | Editing disabled |
| NONE | 0 | No active editor |
| FREETEXT | 3 | Text box editor |
| HIGHLIGHT | 9 | Highlight editor |
| STAMP | 13 | Stamp editor |
| INK | 15 | Ink/freehand drawing editor |
| POPUP | 16 | Comment popup |
| SIGNATURE | 101 | Signature editor |
| COMMENT | 102 | Comment editor |

When adding a new annotation editor type, register a new value here.

### Annotation Editor Architecture (`src/display/editor/`)

All user-facing editors extend the base `AnnotationEditor` class in `editor.js`, which provides:
- Drag/resize/focus/keyboard/undo-redo infrastructure
- Abstract `serialize()` method — converts editor state to a PDF annotation object for saving

Key support classes in `tools.js`:
- `AnnotationEditorUIManager` — central controller; manages the active editor layer, mode switching, and cross-editor state
- `CommandManager` — undo/redo stack (all mutating operations go through it)
- `KeyboardManager` — maps key combos to editor actions

The **drawers pattern**: complex rendering (freehand paths, ink strokes) is split from the editor class into a dedicated drawer in `src/display/editor/drawers/`. The editor handles UX; the drawer handles geometry and SVG/canvas output.

### How a New Editor Type Is Added

1. **`src/shared/util.js`** — add a new `AnnotationEditorType` constant
2. **`src/display/editor/<name>.js`** — create editor class extending `AnnotationEditor`; implement at minimum `serialize()` (returns core annotation data) and `render()` (returns DOM element)
3. **`src/display/editor/annotation_editor_layer.js`** — register the new type in the editor layer's dispatch map
4. **`src/core/annotation.js`** — add a `createNewAnnotation()` static method on the matching core annotation class to write it to PDF on save
5. **`src/display/editor/tools.js`** — add any new `AnnotationEditorParamsType` constants needed for the editor's properties
6. **`web/`** — wire up toolbar button and option in `app_options.js` if user-accessible

### Annotation Tests

| Test file | Layer | What it covers |
|-----------|-------|----------------|
| `test/unit/annotation_spec.js` (5 265 lines) | Core | PDF parsing: AnnotationFactory, all annotation subclasses, AnnotationBorderStyle, `getQuadPoints` — 176 test cases |
| `test/unit/annotation_storage_spec.js` (112 lines) | Display | AnnotationStorage value retrieval, modification tracking, change detection |
| `test/integration/annotation_spec.mjs` (969 lines) | Web viewer | End-to-end rendering: popups, widget z-ordering, form fields, rotated annotations, DOM ordering |
| `test/integration/freetext_editor_spec.mjs` (3 691 lines) | Editor | FreeText create/edit/move/delete, undo-redo, copy-paste, serialization |
| `test/integration/highlight_editor_spec.mjs` (2 857 lines) | Editor | Highlight create, color picker, thickness, free vs. manual mode, rotated PDFs |
| `test/integration/ink_editor_spec.mjs` (1 279 lines) | Editor | Ink drawing, stroke width/color, undo-redo, multi-page |
| `test/integration/stamp_editor_spec.mjs` (1 891 lines) | Editor | Stamp placement, custom images, rotation, copy-paste |
| `test/integration/signature_editor_spec.mjs` (774 lines) | Editor | Signature drawing, theming, aspect ratio |
| `test/integration/comment_spec.mjs` (1 269 lines) | Editor/UI | Comment dialogs, editing, sidebar, undo-redo |

Key test PDFs (in `test/pdfs/`): `annotation-highlight.pdf`, `annotation-caret-ink.pdf`, `tracemonkey.pdf` (used across highlight/stamp/ink/signature tests), `freetexts.pdf`, `empty.pdf` (base for new-annotation creation tests).

To run a single unit test file:
```bash
npx jasmine --filter="<pattern>" test/unit/annotation_spec.js
```

To run a single integration test file:
```bash
npx gulp integrationtest --testfilter="annotation_spec"
```

### Layer Connection Points

- **Core → Display**: `WorkerTransport` (in `src/display/api.js`) receives serialized annotation data from the worker and passes it to `AnnotationLayer` for rendering
- **Editor → Core**: `AnnotationStorage` (in `src/display/annotation_storage.js`) collects editor changes; on save, `src/core/annotation.js` reads them to write PDF objects via `xref` and the `changes` map
- **`putTemporaryRefToCache`** (added in this fork to `src/core/xref.js`): makes newly created PDF objects (e.g. embedded fonts) resolvable within the same save pass, before the PDF is written

---

## Build System Details

### Key Build Targets

| Gulp task | `DEFINES` flags | Output |
|-----------|-----------------|--------|
| `generic` | `GENERIC` | Universal browser bundle in `build/generic/` |
| `components` | `COMPONENTS` | Modular NPM-style bundle |
| `minified` | `MINIFIED` | Production-minimized bundle |
| `lib` | `LIB` | Headless server-side library |
| `dist` | `COMPONENTS` + packaging | `build/dist/` → `@hardroller/pdfjs-dist` |
| `server` | (dev, no bundle) | Dev server at localhost:8888 |

### Preprocessor

`external/builder/` contains `babel-plugin-pdfjs-preprocessor.mjs`, which strips dead branches at build time based on `DEFINES`. The pattern:

```js
if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("GENERIC")) { … }
```

In development (no build), `PDFJSDev` is undefined, so `typeof PDFJSDev !== "undefined"` is `false` and the block is skipped. In a generic build, it evaluates to `true`. Use `PDFJSDev.eval("BUNDLE_VERSION")` to inline build-time string values.
