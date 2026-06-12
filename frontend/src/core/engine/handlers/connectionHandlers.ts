import { toRichText, createShapeId, createBindingId } from "tldraw";
import type { TLShapeId, TLShapePartial } from "tldraw";
import type { ActionHandler } from "../ActionEngine";
import { filterValidProps } from "../../../utils/tldrawInterceptor";

export const handleCreateConnection: ActionHandler = (action, { editor }) => {
  const startId = action.props?.start_id as TLShapeId | undefined;
  const endId = action.props?.end_id as TLShapeId | undefined;
  if (!startId || !endId) return;

  if (!editor.getShape(startId)) return;
  if (!editor.getShape(endId)) return;

  const arrowId = createShapeId();
  
  const arrowProps = filterValidProps(editor, "arrow", {
    richText: toRichText(action.text || ""),
    color: action.props?.color || "black",
    bend: 40,
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
