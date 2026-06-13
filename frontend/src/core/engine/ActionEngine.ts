import type { Editor } from "tldraw";
import type { DrawAction, DrawCommand } from "../../types";

import {
  handleCreateShape,
  handleModifyShape,
  handleDeleteShape,
  handleAlignShapes,
  handleLayerShape,
} from "./handlers/shapeHandlers";
import { handleCreateSvg, handleCreateImage } from "./handlers/mediaHandlers";
import { handleCreateConnection } from "./handlers/connectionHandlers";
import { handleClearCanvas, handleNativeTldrawShape, handleGroupShapes, handleSelectShapes } from "./handlers/systemHandlers";

/** ActionHandler 执行时所需的画布上下文 */
export interface ActionContext {
  editor: Editor;
  canvasW: number;
  canvasH: number;
}

/**
 * Action 处理函数签名。
 * 支持同步和异步两种模式 —— 异步 handler（如图片加载）返回 Promise，
 * 引擎会等待其完成后再执行后续的 zoomToFit。
 */
export type ActionHandler = (action: DrawAction, context: ActionContext) => void | Promise<void>;

/**
 * 指令 → 处理函数的注册表。
 * 键类型使用 DrawCommand 联合类型，确保与类型定义严格对齐。
 */
const handlers: Record<DrawCommand, ActionHandler> = {
  create_shape: handleCreateShape,
  modify_shape: handleModifyShape,
  delete_shape: handleDeleteShape,
  align_shapes: handleAlignShapes,
  layer_shape: handleLayerShape,
  create_svg: handleCreateSvg,
  create_image: handleCreateImage,
  create_connection: handleCreateConnection,
  clear_canvas: handleClearCanvas,
  native_tldraw_shape: handleNativeTldrawShape,
  group_shapes: handleGroupShapes,
  select_shapes: handleSelectShapes,
};

/**
 * 核心绘制引擎入口：按序执行 AI 下发的 DrawAction 列表。
 * 所有 action 执行完毕后（包括异步的图片加载），自动触发 zoomToFit。
 *
 * @param actions - AI 解析出的绘制指令序列
 * @param context - 画布上下文（editor 实例 + 可视区域尺寸）
 * @returns 执行过程中捕获的错误消息列表
 */
export const executeActionEngine = async (
  actions: DrawAction[],
  context: ActionContext,
): Promise<string[]> => {
  const errors: string[] = [];

  for (const action of actions) {
    try {
      if (!action.command) continue;
      const handler = handlers[action.command];
      if (handler) {
        await handler(action, context);
      } else {
        const msg = `Unrecognized command: ${action.command}`;
        console.warn(`[ActionEngine] ${msg}`);
        errors.push(msg);
      }
    } catch (e: unknown) {
      console.error("[ActionEngine] Failed executing action:", action, e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      errors.push(`Action ${action.command} failed: ${errorMessage}`);
    }
  }

  setTimeout(() => {
    context.editor.zoomToFit({ animation: { duration: 300 } });
  }, 150);

  return errors;
};
