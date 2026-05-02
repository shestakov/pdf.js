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

import { MathClamp } from "../../../shared/util.js";
import { Outline } from "./outline.js";

/**
 * Outliner used during active drag-drawing of a rectangle.
 * Coordinates are in [0,1] normalized parent space.
 */
class RectDrawOutliner {
  #x1;

  #y1;

  #x2;

  #y2;

  #parentWidth;

  #parentHeight;

  #rotation;

  #halfStrokeNormX = 0;

  #halfStrokeNormY = 0;

  #thickness = 1;

  #outlines = new RectDrawOutline();

  constructor(
    x,
    y,
    parentWidth,
    parentHeight,
    rotation,
    halfStrokePx = 0,
    thickness = 1
  ) {
    this.#parentWidth = parentWidth;
    this.#parentHeight = parentHeight;
    this.#rotation = rotation;
    this.#thickness = thickness;
    [this.#x1, this.#y1] = this.#normalizePoint(x, y);
    this.#x2 = this.#x1;
    this.#y2 = this.#y1;
    if (rotation % 180 === 0) {
      this.#halfStrokeNormX = halfStrokePx / parentWidth;
      this.#halfStrokeNormY = halfStrokePx / parentHeight;
    } else {
      this.#halfStrokeNormX = halfStrokePx / parentHeight;
      this.#halfStrokeNormY = halfStrokePx / parentWidth;
    }
  }

  updateProperty(name, value) {
    if (name === "stroke-width") {
      this.#thickness = value;
    }
  }

  #normalizePoint(x, y) {
    return Outline._normalizePoint(
      x,
      y,
      this.#parentWidth,
      this.#parentHeight,
      this.#rotation
    );
  }

  isEmpty() {
    return this.#x1 === this.#x2 && this.#y1 === this.#y2;
  }

  isCancellable() {
    return this.isEmpty();
  }

  add(x, y, _lockX, _lockY) {
    [this.#x2, this.#y2] = this.#normalizePoint(x, y);
    return { path: { d: this.#toSVGPath() } };
  }

  end(x, y, lockX, lockY) {
    return this.add(x, y, lockX, lockY);
  }

  startNew() {
    return null;
  }

  getLastElement() {
    return null;
  }

  setLastElement(_el) {
    return null;
  }

  removeLastElement() {
    return { path: { d: this.#toSVGPath() } };
  }

  #toSVGPath() {
    const minX = Math.min(this.#x1, this.#x2) - this.#halfStrokeNormX;
    const minY = Math.min(this.#y1, this.#y2) - this.#halfStrokeNormY;
    const maxX = Math.max(this.#x1, this.#x2) + this.#halfStrokeNormX;
    const maxY = Math.max(this.#y1, this.#y2) + this.#halfStrokeNormY;
    const r = Outline.svgRound;
    return `M${r(minX)} ${r(minY)}H${r(maxX)}V${r(maxY)}H${r(minX)}Z`;
  }

  get defaultSVGProperties() {
    return {
      root: { viewBox: "0 0 10000 10000" },
      rootClass: { draw: true },
      bbox: [0, 0, 1, 1],
    };
  }

  getOutlines(parentWidth, parentHeight, scale, innerMargin) {
    const minX = MathClamp(Math.min(this.#x1, this.#x2), 0, 1);
    const minY = MathClamp(Math.min(this.#y1, this.#y2), 0, 1);
    const maxX = MathClamp(Math.max(this.#x1, this.#x2), 0, 1);
    const maxY = MathClamp(Math.max(this.#y1, this.#y2), 0, 1);
    this.#outlines.build(
      minX,
      minY,
      maxX,
      maxY,
      parentWidth,
      parentHeight,
      scale,
      this.#rotation,
      innerMargin,
      this.#thickness
    );
    return this.#outlines;
  }
}

class RectDrawOutline extends Outline {
  // Bounding box [x, y, width, height] in normalized [0,1] parent space,
  // expanded by the stroke/margin.
  #bbox;

  // The four corners of the rect (no margin), stored as [x1, y1, x2, y2].
  #corners;

  #currentRotation = 0;

  #innerMargin;

  #parentWidth;

  #parentHeight;

  #parentScale;

  #rotation;

  #thickness = 1;

  build(
    minX,
    minY,
    maxX,
    maxY,
    parentWidth,
    parentHeight,
    scale,
    rotation,
    innerMargin,
    thickness = 1
  ) {
    this.#parentWidth = parentWidth;
    this.#parentHeight = parentHeight;
    this.#parentScale = scale;
    this.#rotation = rotation;
    this.#innerMargin = innerMargin ?? 0;
    this.#thickness = thickness;
    this.#corners = new Float32Array([minX, minY, maxX, maxY]);
    this.#computeBbox();
  }

  #getMarginComponents(thickness = this.#thickness) {
    const margin = this.#innerMargin + thickness * this.#parentScale;
    return this.#rotation % 180 === 0
      ? [margin / this.#parentWidth, margin / this.#parentHeight]
      : [margin / this.#parentHeight, margin / this.#parentWidth];
  }

  #computeBbox() {
    const [x1, y1, x2, y2] = this.#corners;
    const [marginX, marginY] = this.#getMarginComponents();
    this.#bbox = new Float32Array([
      MathClamp(x1 - marginX, 0, 1),
      MathClamp(y1 - marginY, 0, 1),
      MathClamp(x2 + marginX, 0, 1) - MathClamp(x1 - marginX, 0, 1),
      MathClamp(y2 + marginY, 0, 1) - MathClamp(y1 - marginY, 0, 1),
    ]);
  }

  get box() {
    return this.#bbox;
  }

  get thickness() {
    return this.#thickness;
  }

  toSVGPath() {
    const [x1, y1, x2, y2] = this.#corners;
    const [mx, my] = this.#getMarginComponents();
    const [imx, imy] = this.#getMarginComponents(0);
    const hsx = (mx - imx) / 2;
    const hsy = (my - imy) / 2;
    const r = Outline.svgRound;
    return `M${r(x1 - hsx)} ${r(y1 - hsy)}H${r(x2 + hsx)}V${r(y2 + hsy)}H${r(x1 - hsx)}Z`;
  }

  updateProperty(name, value) {
    if (name === "stroke-width") {
      return this.#updateThickness(value);
    }
    return null;
  }

  #updateThickness(thickness) {
    const [oldMX, oldMY] = this.#getMarginComponents();
    this.#thickness = thickness;
    const [newMX, newMY] = this.#getMarginComponents();
    const bbox = this.#bbox;
    bbox[0] -= newMX - oldMX;
    bbox[1] -= newMY - oldMY;
    bbox[2] += 2 * (newMX - oldMX);
    bbox[3] += 2 * (newMY - oldMY);
    return bbox;
  }

  updateParentDimensions([width, height], scale) {
    const [oldMX, oldMY] = this.#getMarginComponents();
    this.#parentWidth = width;
    this.#parentHeight = height;
    this.#parentScale = scale;
    const [newMX, newMY] = this.#getMarginComponents();
    const diffMX = newMX - oldMX;
    const diffMY = newMY - oldMY;
    const bbox = this.#bbox;
    const sx = this.#parentWidth / width;
    const sy = this.#parentHeight / height;
    // Rescale corners.
    this.#corners[0] *= sx;
    this.#corners[1] *= sy;
    this.#corners[2] *= sx;
    this.#corners[3] *= sy;
    bbox[0] = bbox[0] * sx - diffMX;
    bbox[1] = bbox[1] * sy - diffMY;
    bbox[2] = bbox[2] * sx + 2 * diffMX;
    bbox[3] = bbox[3] * sy + 2 * diffMY;
    return bbox;
  }

  updateRotation(rotation) {
    this.#currentRotation = rotation;
    return { path: { transform: this.rotationTransform } };
  }

  get viewBox() {
    return this.#bbox.map(Outline.svgRound).join(" ");
  }

  get defaultProperties() {
    const [x, y] = this.#bbox;
    return {
      root: { viewBox: this.viewBox },
      path: {
        "transform-origin": `${Outline.svgRound(x)} ${Outline.svgRound(y)}`,
      },
    };
  }

  get rotationTransform() {
    const [, , w, h] = this.#bbox;
    let a = 0,
      b = 0,
      c = 0,
      d = 0,
      e = 0,
      f = 0;
    switch (this.#currentRotation) {
      case 90:
        b = h / w;
        c = -w / h;
        e = w;
        break;
      case 180:
        a = -1;
        d = -1;
        e = w;
        f = h;
        break;
      case 270:
        b = -h / w;
        c = w / h;
        f = h;
        break;
      default:
        return "";
    }
    return `matrix(${a} ${b} ${c} ${d} ${Outline.svgRound(e)} ${Outline.svgRound(f)})`;
  }

  get defaultSVGProperties() {
    const bbox = this.#bbox;
    return {
      root: { viewBox: this.viewBox },
      rootClass: { draw: true },
      path: {
        d: this.toSVGPath(),
        "transform-origin": `${Outline.svgRound(bbox[0])} ${Outline.svgRound(bbox[1])}`,
        transform: this.rotationTransform || null,
      },
      bbox,
    };
  }

  getPathResizingSVGProperties([newX, newY, newWidth, newHeight]) {
    const [mx, my] = this.#getMarginComponents();
    const [imx, imy] = this.#getMarginComponents(0);
    const hsx = (mx - imx) / 2;
    const hsy = (my - imy) / 2;
    const cx1 = newX + mx;
    const cy1 = newY + my;
    const cx2 = newX + newWidth - mx;
    const cy2 = newY + newHeight - my;
    const r = Outline.svgRound;
    return {
      root: {
        viewBox: `${r(newX)} ${r(newY)} ${r(newWidth)} ${r(newHeight)}`,
      },
      path: {
        d: `M${r(cx1 - hsx)} ${r(cy1 - hsy)}H${r(cx2 + hsx)}V${r(cy2 + hsy)}H${r(cx1 - hsx)}Z`,
        "transform-origin": `${r(newX)} ${r(newY)}`,
        transform: this.rotationTransform || null,
      },
    };
  }

  getPathResizedSVGProperties([newX, newY, newWidth, newHeight]) {
    const [marginX, marginY] = this.#getMarginComponents();
    const bbox = this.#bbox;
    bbox[0] = newX;
    bbox[1] = newY;
    bbox[2] = newWidth;
    bbox[3] = newHeight;

    this.#corners[0] = newX + marginX;
    this.#corners[1] = newY + marginY;
    this.#corners[2] = newX + newWidth - marginX;
    this.#corners[3] = newY + newHeight - marginY;

    return {
      root: { viewBox: this.viewBox },
      path: {
        d: this.toSVGPath(),
        "transform-origin": `${Outline.svgRound(newX)} ${Outline.svgRound(newY)}`,
        transform: this.rotationTransform || null,
      },
    };
  }

  getPathTranslatedSVGProperties([newX, newY], _parentDimensions) {
    const bbox = this.#bbox;
    const tx = newX - bbox[0];
    const ty = newY - bbox[1];
    this.#corners[0] += tx;
    this.#corners[1] += ty;
    this.#corners[2] += tx;
    this.#corners[3] += ty;
    bbox[0] = newX;
    bbox[1] = newY;
    return {
      root: { viewBox: this.viewBox },
      path: {
        d: this.toSVGPath(),
        "transform-origin": `${Outline.svgRound(newX)} ${Outline.svgRound(newY)}`,
      },
    };
  }

  serialize([pageX, pageY, pageWidth, pageHeight], _isForCopying) {
    const [x1, y1, x2, y2] = this.#corners;
    let rx1, ry1, rx2, ry2;
    switch (this.#rotation) {
      case 90:
        rx1 = pageX + y1 * pageWidth;
        ry1 = pageY + x1 * pageHeight;
        rx2 = pageX + y2 * pageWidth;
        ry2 = pageY + x2 * pageHeight;
        break;
      case 180:
        rx1 = pageX + (1 - x2) * pageWidth;
        ry1 = pageY + y1 * pageHeight;
        rx2 = pageX + (1 - x1) * pageWidth;
        ry2 = pageY + y2 * pageHeight;
        break;
      case 270:
        rx1 = pageX + (1 - y2) * pageWidth;
        ry1 = pageY + (1 - x2) * pageHeight;
        rx2 = pageX + (1 - y1) * pageWidth;
        ry2 = pageY + (1 - x1) * pageHeight;
        break;
      default:
        // rotation = 0: screen y goes down, PDF y goes up
        rx1 = pageX + x1 * pageWidth;
        ry1 = pageY + (1 - y2) * pageHeight;
        rx2 = pageX + x2 * pageWidth;
        ry2 = pageY + (1 - y1) * pageHeight;
    }
    return { rect: [rx1, ry1, rx2, ry2] };
  }

  static deserialize(
    pageX,
    pageY,
    pageWidth,
    pageHeight,
    innerMargin,
    { rect, rotation, thickness }
  ) {
    // /Rect is outer bounds; recover inner corners by insetting by bw.
    const bw = thickness || 0;
    const r0 = rect[0] + bw;
    const r1 = rect[1] + bw;
    const r2 = rect[2] - bw;
    const r3 = rect[3] - bw;

    // Convert inner corners from PDF page coords to normalized [0,1] coords.
    let minX, minY, maxX, maxY;
    switch (rotation) {
      case 90:
        minX = (r1 - pageY) / pageHeight;
        minY = (r0 - pageX) / pageWidth;
        maxX = (r3 - pageY) / pageHeight;
        maxY = (r2 - pageX) / pageWidth;
        break;
      case 180:
        minX = 1 - (r2 - pageX) / pageWidth;
        minY = (r1 - pageY) / pageHeight;
        maxX = 1 - (r0 - pageX) / pageWidth;
        maxY = (r3 - pageY) / pageHeight;
        break;
      case 270:
        minX = 1 - (r3 - pageY) / pageHeight;
        minY = 1 - (r2 - pageX) / pageWidth;
        maxX = 1 - (r1 - pageY) / pageHeight;
        maxY = 1 - (r0 - pageX) / pageWidth;
        break;
      default:
        // rotation = 0
        minX = (r0 - pageX) / pageWidth;
        minY = 1 - (r3 - pageY) / pageHeight;
        maxX = (r2 - pageX) / pageWidth;
        maxY = 1 - (r1 - pageY) / pageHeight;
    }
    const outlines = new RectDrawOutline();
    outlines.build(
      MathClamp(minX, 0, 1),
      MathClamp(minY, 0, 1),
      MathClamp(maxX, 0, 1),
      MathClamp(maxY, 0, 1),
      pageWidth,
      pageHeight,
      1,
      rotation,
      innerMargin,
      thickness
    );
    return outlines;
  }
}

export { RectDrawOutline, RectDrawOutliner };
