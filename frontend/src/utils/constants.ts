/**
 * TLDraw 合法枚举值的唯一真相源（Single Source of Truth）。
 * sanitizers.ts 和 tldrawInterceptor.ts 均从此处引用，禁止各自维护副本。
 */

/** TLDraw 合法颜色值集合 */
export const VALID_TLDRAW_COLORS = new Set([
  "black",
  "grey",
  "light-violet",
  "violet",
  "blue",
  "light-blue",
  "yellow",
  "orange",
  "green",
  "light-green",
  "light-red",
  "red",
  "white",
]);

/** TLDraw 合法 dash 样式 */
export const VALID_TLDRAW_DASHES = new Set(["draw", "solid", "dashed", "dotted", "none"]);

/** TLDraw 合法 fill 样式 */
export const VALID_TLDRAW_FILLS = new Set(["none", "semi", "solid", "pattern"]);

/** TLDraw 合法 size 枚举 */
export const VALID_TLDRAW_SIZES = new Set(["s", "m", "l", "xl"]);

/** TLDraw 合法文字对齐方式 */
export const VALID_TLDRAW_ALIGNS = new Set([
  "start", "middle", "end", "justify",
  "start-legacy", "end-legacy", "center-legacy",
]);

/** TLDraw 合法字体 */
export const VALID_TLDRAW_FONTS = new Set(["draw", "sans", "serif", "mono"]);

/** TLDraw 合法 geo 形状类型 */
export const VALID_TLDRAW_GEOS = new Set([
  "rectangle",
  "ellipse",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "octagon",
  "star",
  "rhombus",
  "oval",
  "cloud",
]);
