import type { TLShapeId } from "tldraw";
import type { ActionHandler } from "../ActionEngine";
import { executeWithInterceptor } from "../../../utils/tldrawInterceptor";

/** 处理 clear_canvas 指令：清空当前页面的所有 shape。 */
export const handleClearCanvas: ActionHandler = (_action, { editor }) => {
  const allShapes = editor.getCurrentPageShapes();
  editor.deleteShapes(allShapes.map((s) => s.id));
};

/**
 * 处理 native_tldraw_shape 指令：直接透传 LLM 生成的原始 shape 数据。
 * 这是一个"逃生舱"机制，允许 LLM 使用 TLDraw 的全部原生能力。
 * 通过 executeWithInterceptor 提供校验和降级保护。
 */
export const handleNativeTldrawShape: ActionHandler = (action, { editor }) => {
  const nativeShape: Record<string, unknown> = { ...action.props };
  if (action.target_id) {
    nativeShape.id = action.target_id;
  }
  executeWithInterceptor(editor, nativeShape);
};

/** 处理 group_shapes 指令：将多个 shape 编为一组。 */
export const handleGroupShapes: ActionHandler = (action, { editor }) => {
  const targetIds = ((action.props?.target_ids as string[]) || []).map((id) => id as TLShapeId);
  if (targetIds.length > 0) {
    editor.groupShapes(targetIds);
  }
};

/** 处理 select_shapes 指令：选中指定的多个 shape。 */
export const handleSelectShapes: ActionHandler = (action, { editor }) => {
  const targetIds = ((action.props?.target_ids as string[]) || []).map((id) => id as TLShapeId);
  editor.select(...targetIds);
};
