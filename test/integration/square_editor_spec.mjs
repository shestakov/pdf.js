/* Copyright 2024 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  applyFunctionToEditor,
  awaitPromise,
  closePages,
  getFirstSerialized,
  loadAndWait,
  switchToEditor,
  waitForPointerUp,
  waitForSerialized,
} from "./test_utils.mjs";

const switchToBox = switchToEditor.bind(null, "Box");

const drawBox = async (page, x0, y0, x1, y1) => {
  const clickHandle = await waitForPointerUp(page);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1);
  await page.mouse.up();
  await awaitPromise(clickHandle);
};

describe("Box Editor", () => {
  describe("Thickness round-trip", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("empty.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that serialized thickness matches the SVG stroke-width", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToBox(page);

          const rect = await page.$eval(".annotationEditorLayer", el =>
            el.getBoundingClientRect().toJSON()
          );

          // Draw a box
          const x0 = rect.x + 100;
          const y0 = rect.y + 100;
          await drawBox(page, x0, y0, x0 + 120, y0 + 80);
          await waitForSerialized(page, 1);

          // Read the serialized thickness (PDF points)
          const { thickness: serializedThickness } =
            await getFirstSerialized(page);

          // Read the SVG stroke-width attribute on the draw SVG element.
          // With vector-effect="non-scaling-stroke" this is in CSS pixels.
          const svgStrokeWidth = await page.$eval(
            ".canvasWrapper svg.draw",
            el => parseFloat(el.getAttribute("stroke-width"))
          );

          // Read the current viewer scale and
          // compute realScale (CSS px / PDF pt).
          const realScale = await page.evaluate(
            () => window.PDFViewerApplication.pdfViewer.currentScale * (96 / 72)
          );

          // The SVG stroke-width (CSS px) must equal
          // serializedthickness (PDF pt) × realScale.
          expect(svgStrokeWidth)
            .withContext(`In ${browserName}`)
            .toBeCloseTo(serializedThickness * realScale, 1);
        })
      );
    });
  });

  describe("annotationId round-trip", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("empty.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must persist annotationId set on the editor into serialized output", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToBox(page);

          const rect = await page.$eval(".annotationEditorLayer", el =>
            el.getBoundingClientRect().toJSON()
          );

          const x0 = rect.x + 50;
          const y0 = rect.y + 50;
          await drawBox(page, x0, y0, x0 + 100, y0 + 60);
          await waitForSerialized(page, 1);

          await applyFunctionToEditor(
            page,
            "pdfjs_internal_editor_0",
            editor => {
              editor.annotationId = "test-id";
            }
          );

          const { annotationId } = await getFirstSerialized(page);
          expect(annotationId)
            .withContext(`In ${browserName}`)
            .toEqual("test-id");
        })
      );
    });
  });
});
