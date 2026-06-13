import { toRichText, createShapeId, createBindingId } from "tldraw";
import type { TLShapeId, TLShapePartial } from "tldraw";
import type { ActionHandler } from "../ActionEngine";
import { filterValidProps } from "../../../utils/tldrawInterceptor";

/** 默认箭头弯曲度 */
const DEFAULT_ARROW_BEND = 40;

/**
 * 处理 create_connection 指令：在两个 shape 之间创建带弯曲的箭头连线。
 * 通过 TLDraw Binding API 绑定箭头端点到目标 shape 中心。
 *
 * @remarks 弯曲度优先使用 LLM 返回的 `action.props.bend`，缺省为 40。
 */
export const handleCreateConnection: ActionHandler = (action, { editor }) => {
  const startId = action.props?.start_id as TLShapeId | undefined;
  const endId = action.props?.end_id as TLShapeId | undefined;
  if (!startId || !endId) return;

  if (!editor.getShape(startId)) return;
  if (!editor.getShape(endId)) return;

  const arrowId = createShapeId();
  const bend = typeof action.props?.bend === "number" ? action.props.bend : DEFAULT_ARROW_BEND;
  
  const arrowProps = filterValidProps(editor, "arrow", {
    richText: toRichText(action.text || ""),
    color: action.props?.color || "black",
    bend,
    start: { type: "point", x: 0, y: 0 },
    end: { type: "point", x: 0, y: 0 },
  });

  editor.createShape({
    id: arrowId,
    type: "arrow",
    x: 0,
    y: 0,
    props: arrowProps,
  } as TLShapePartial);

  editor.createBinding({
    id: createBindingId(),
    type: "arrow" as const,
    fromId: arrowId,
    toId: startId,
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
    toId: endId,
    props: {
      terminal: "end" as const,
      normalizedAnchor: { x: 0.5, y: 0.5 },
      isPrecise: false,
      isExact: false,
    },
  });
};
