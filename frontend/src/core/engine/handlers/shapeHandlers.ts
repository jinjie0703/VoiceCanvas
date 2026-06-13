import { toRichText } from "tldraw";
import type { TLShapeId } from "tldraw";
import type { ActionHandler } from "../ActionEngine";
import { resolveActionCoords } from "../../../utils/coords";
import { filterValidProps, executeWithInterceptor, executeUpdateWithInterceptor } from "../../../utils/tldrawInterceptor";
import { sanitizeColor, sanitizeGeo, sanitizeNumber } from "../../../utils/sanitizers";

/** 提取 shape.props 中常用字段的辅助类型，避免重复的 `as unknown as X` 双重断言 */
type ShapePropsWithMeta = { color?: string; geo?: string };

/**
 * 处理 create_shape 指令：在画布上创建 geo 或 note 类型的形状。
 * 支持精确坐标和语义方位两种定位方式。
 */
export const handleCreateShape: ActionHandler = (action, { editor, canvasW, canvasH }) => {
  const { x, y } = resolveActionCoords(action, canvasW, canvasH);

  const shapeType = action.type === "note" ? "note" : "geo";
  const defaultColor = shapeType === "note" ? "yellow" : "blue";
  const shapeProps: Record<string, unknown> = {
    color: sanitizeColor(action.props?.color, defaultColor),
    richText: toRichText(action.text !== undefined && action.text !== null ? String(action.text) : ""),
  };

  if (shapeType !== "note") {
    shapeProps.w = sanitizeNumber(action.props?.w, 150);
    shapeProps.h = sanitizeNumber(action.props?.h, 100);
    shapeProps.geo = sanitizeGeo(action.props?.geo, "rectangle");
  }

  const newShape: Record<string, unknown> = {
    type: shapeType,
    x,
    y,
    props: shapeProps,
  };
  if (action.target_id) newShape.id = action.target_id;
  executeWithInterceptor(editor, newShape);
};

/**
 * 处理 modify_shape 指令：修改已有 shape 的属性（颜色、文本、尺寸等）。
 * 会基于当前 shape 类型过滤不合法的属性组合（如 note 不支持 w/h）。
 */
export const handleModifyShape: ActionHandler = (action, { editor }) => {
  if (!action.target_id) return;
  const targetId = action.target_id as TLShapeId;
  const currentShape = editor.getShape(targetId);
  if (!currentShape) return;

  const cleanProps = { ...action.props };
  const currentProps = currentShape.props as unknown as ShapePropsWithMeta;

  if ("color" in cleanProps) {
    cleanProps.color = sanitizeColor(cleanProps.color, currentProps.color || "black");
  }
  if ("geo" in cleanProps && currentShape.type === "geo") {
    cleanProps.geo = sanitizeGeo(cleanProps.geo, currentProps.geo || "rectangle");
  }

  if (currentShape.type === "note") {
    delete cleanProps.w;
    delete cleanProps.h;
    delete cleanProps.text;
    if (action.text !== undefined && action.text !== null) cleanProps.richText = toRichText(String(action.text));
  } else {
    if (action.text !== undefined && action.text !== null) cleanProps.richText = toRichText(String(action.text));
  }

  executeUpdateWithInterceptor(editor, {
    id: targetId,
    type: currentShape.type,
    props: filterValidProps(editor, currentShape.type, {
      ...currentShape.props,
      ...cleanProps,
    }),
  });
};

/** 处理 delete_shape 指令：根据 target_id 删除指定 shape。 */
export const handleDeleteShape: ActionHandler = (action, { editor }) => {
  if (!action.target_id) return;
  editor.deleteShape(action.target_id as TLShapeId);
};

/** 处理 align_shapes 指令：对齐多个 shape（水平居中、左对齐等）。 */
export const handleAlignShapes: ActionHandler = (action, { editor }) => {
  const rawIds = Array.isArray(action.props?.target_ids) ? action.props.target_ids : [];
  const targetIds = rawIds.map((id) => id as TLShapeId);
  if (targetIds.length < 2) return;
  let alignment = (action.props?.alignment as string) || "center-horizontal";
  if (alignment === "center") alignment = "center-horizontal";
  if (alignment === "middle") alignment = "center-vertical";
  const validAlignments = ["top", "left", "right", "bottom", "center-horizontal", "center-vertical"];
  if (!validAlignments.includes(alignment)) {
    alignment = "center-horizontal";
  }
  editor.alignShapes(targetIds, alignment as "top" | "left" | "right" | "bottom" | "center-horizontal" | "center-vertical");
};

/** 处理 layer_shape 指令：调整 shape 的图层顺序（置顶、置底等）。 */
export const handleLayerShape: ActionHandler = (action, { editor }) => {
  if (!action.target_id) return;
  const targetId = action.target_id as TLShapeId;
  const layerAction = action.props?.action as string;
  if (layerAction === "front") editor.bringToFront([targetId]);
  else if (layerAction === "back") editor.sendToBack([targetId]);
  else if (layerAction === "forward") editor.bringForward([targetId]);
  else if (layerAction === "backward") editor.sendBackward([targetId]);
};
