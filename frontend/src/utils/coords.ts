import type { DrawAction } from "../types";
import type { SemanticPosition } from "../types";

/**
 * 将画布上的像素坐标映射为九宫格语义方位。
 * 用于生成画布快照时向 LLM 描述 shape 的大致位置。
 *
 * @param x - shape 的绝对 X 坐标
 * @param y - shape 的绝对 Y 坐标
 * @param canvasW - 画布可视宽度（px）
 * @param canvasH - 画布可视高度（px）
 * @returns 九宫格方位字符串
 */
export const getSemanticPosition = (x: number, y: number, canvasW: number, canvasH: number): SemanticPosition => {
  const xPct = x / canvasW;
  const yPct = y / canvasH;

  if (yPct < 0.35) {
    if (xPct < 0.35) return "top_left";
    if (xPct > 0.65) return "top_right";
    return "top_center";
  }
  if (yPct > 0.65) {
    if (xPct < 0.35) return "bottom_left";
    if (xPct > 0.65) return "bottom_right";
    return "bottom_center";
  }
  if (xPct < 0.35) return "center_left";
  if (xPct > 0.65) return "center_right";
  return "center";
};

/**
 * 将九宫格语义方位反向映射为画布上的像素坐标。
 * 用于根据 LLM 返回的语义位置在画布上精确放置 shape。
 *
 * @param pos - 九宫格语义方位字符串
 * @param canvasW - 画布可视宽度（px）
 * @param canvasH - 画布可视高度（px）
 * @returns 像素坐标 { x, y }
 */
export const getCoordsFromSemantic = (pos: string, canvasW: number, canvasH: number): { x: number; y: number } => {
  const paddingX = Math.max(100, canvasW * 0.15);
  const paddingY = Math.max(100, canvasH * 0.15);
  const shapeOffset = 200; // 预留 shape 自身宽高的偏移量

  switch (pos) {
    case "top_left":
      return { x: paddingX, y: paddingY };
    case "top_center":
      return { x: canvasW / 2 - shapeOffset / 2, y: paddingY };
    case "top_right":
      return { x: canvasW - paddingX - shapeOffset, y: paddingY };
    case "center_left":
      return { x: paddingX, y: canvasH / 2 - shapeOffset / 2 };
    case "center_right":
      return { x: canvasW - paddingX - shapeOffset, y: canvasH / 2 - shapeOffset / 2 };
    case "bottom_left":
      return { x: paddingX, y: canvasH - paddingY - shapeOffset };
    case "bottom_center":
      return { x: canvasW / 2 - shapeOffset / 2, y: canvasH - paddingY - shapeOffset };
    case "bottom_right":
      return { x: canvasW - paddingX - shapeOffset, y: canvasH - paddingY - shapeOffset };
    case "center":
    default:
      return { x: canvasW / 2 - shapeOffset / 2, y: canvasH / 2 - shapeOffset / 2 };
  }
};

/**
 * 从 DrawAction 中统一解析放置坐标。
 * 优先使用精确坐标（action.x / action.y），回退到语义方位。
 * 消除 shapeHandlers / mediaHandlers 中重复的坐标计算逻辑。
 *
 * @param action - AI 下发的绘制指令
 * @param canvasW - 画布可视宽度（px）
 * @param canvasH - 画布可视高度（px）
 * @returns 像素坐标 { x, y }
 */
export const resolveActionCoords = (
  action: DrawAction,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } => {
  if (typeof action.x === "number" && typeof action.y === "number") {
    return {
      x: canvasW / 2 + action.x,
      y: canvasH / 2 + action.y,
    };
  }
  return getCoordsFromSemantic(action.position || "center", canvasW, canvasH);
};
