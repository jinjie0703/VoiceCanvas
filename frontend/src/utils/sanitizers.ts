import { VALID_TLDRAW_COLORS, VALID_TLDRAW_GEOS } from "./constants";

/**
 * 校验并修正颜色值，确保符合 TLDraw 枚举。
 * 自动将 LLM 常见幻觉（如 "gray"→"grey"）映射为合法值。
 *
 * @param color - 待校验的颜色值（来自 LLM 输出）
 * @param defaultColor - 校验失败时的回退颜色
 * @returns 合法的 TLDraw 颜色字符串
 */
export const sanitizeColor = (color: unknown, defaultColor: string): string => {
  if (!color || typeof color !== "string") return defaultColor;
  const lowerColor = color.toLowerCase();
  if (lowerColor === "gray") return "grey";

  if (VALID_TLDRAW_COLORS.has(lowerColor)) return lowerColor;
  return defaultColor;
};

/**
 * 校验并修正几何形状类型，确保符合 TLDraw 枚举。
 * 自动将 LLM 常见幻觉（如 "circle"→"ellipse"、"square"→"rectangle"）映射为合法值。
 *
 * @param geo - 待校验的形状类型（来自 LLM 输出）
 * @param defaultGeo - 校验失败时的回退形状
 * @returns 合法的 TLDraw geo 字符串
 */
export const sanitizeGeo = (geo: unknown, defaultGeo: string): string => {
  if (!geo || typeof geo !== "string") return defaultGeo;
  const lowerGeo = geo.toLowerCase();
  if (lowerGeo === "circle") return "ellipse";
  if (lowerGeo === "square") return "rectangle";

  if (VALID_TLDRAW_GEOS.has(lowerGeo)) return lowerGeo;
  return defaultGeo;
};

/**
 * 校验并修正数值类型，确保不传入包含单位的字符串或非法类型。
 *
 * @param num - 待校验的数值（可能为字符串，例如 "300px" 或 "300"）
 * @param defaultNum - 校验失败时的回退数值
 * @returns 合法的 number 类型
 */
export const sanitizeNumber = (num: unknown, defaultNum: number): number => {
  if (typeof num === "number" && isFinite(num)) return num;
  if (typeof num === "string") {
    const parsed = parseFloat(num);
    if (!isNaN(parsed) && isFinite(parsed)) return parsed;
  }
  return defaultNum;
};

