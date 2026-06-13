import { toRichText, createShapeId, createBindingId } from "tldraw";
import type { TLShapeId } from "tldraw";
import type { ActionHandler } from "../ActionEngine";
import { filterValidProps, executeWithInterceptor } from "../../../utils/tldrawInterceptor";

/** 默认箭头弯曲度 */
const DEFAULT_ARROW_BEND = 40;

/**
 * 处理 create_connection 指令：在两个 shape 之间创建带弯曲的箭头连线。
 * 通过 TLDraw Binding API 绑定箭头端点到目标 shape 中心。
 *
 * @remarks 弯曲度优先使用 LLM 返回的 `action.props.bend`，缺省为 40。
 */
export const handleCreateConnection: ActionHandler = (action, { editor }) => {
  let startId = action.props?.start_id ? String(action.props.start_id) : undefined;
  let endId = action.props?.end_id ? String(action.props.end_id) : undefined;

  if (startId && !startId.startsWith("shape:")) startId = `shape:${startId}`;
  if (endId && !endId.startsWith("shape:")) endId = `shape:${endId}`;

  if (!startId || !endId) return;

  if (!editor.getShape(startId as TLShapeId)) return;
  if (!editor.getShape(endId as TLShapeId)) return;

  const arrowId = createShapeId();
  const bend = typeof action.props?.bend === "number" ? action.props.bend : DEFAULT_ARROW_BEND;
  
  const arrowProps = filterValidProps(editor, "arrow", {
    richText: toRichText(action.text !== undefined && action.text !== null ? String(action.text) : ""),
    color: action.props?.color || "black",
    bend,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
  });

  executeWithInterceptor(editor, {
    id: arrowId,
    type: "arrow",
    x: 0,
    y: 0,
    props: arrowProps,
  });

  editor.createBinding({
    id: createBindingId(),
    type: "arrow" as const,
    fromId: arrowId,
    toId: startId as TLShapeId,
    props: {
      terminal: "start" as const,
      normalizedAnchor: { x: 0.5, y: 0.5 },
      isPrecise: false,
      isExact: false,
    },
  });

  editor.createBinding({
    id: createBindingId(),
    type: "arrow" as const,
    fromId: arrowId,
    toId: endId as TLShapeId,
    props: {
      terminal: "end" as const,
      normalizedAnchor: { x: 0.5, y: 0.5 },
      isPrecise: false,
      isExact: false,
    },
  });
};
