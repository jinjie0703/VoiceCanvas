import { toRichText } from "tldraw";
import type { TLShapeId, TLShapePartial } from "tldraw";
import type { ActionHandler } from "../ActionEngine";
import { getCoordsFromSemantic } from "../../../utils/coords";
import { filterValidProps } from "../../../utils/tldrawInterceptor";
import { sanitizeColor, sanitizeGeo } from "../../../utils/sanitizers";

export const handleCreateShape: ActionHandler = (action, { editor, canvasW, canvasH }) => {
  let x, y;
  if (typeof action.x === "number" && typeof action.y === "number") {
    x = canvasW / 2 + action.x;
    y = canvasH / 2 + action.y;
  } else {
    const coords = getCoordsFromSemantic(action.position || "center", canvasW, canvasH);
    x = coords.x;
    y = coords.y;
  }

  const shapeType = action.type === "note" ? "note" : "geo";
  const defaultColor = shapeType === "note" ? "yellow" : "blue";
  const shapeProps: Record<string, unknown> = {
    color: sanitizeColor(action.props?.color, defaultColor),
  };

  if (shapeType === "note") {
    shapeProps.richText = toRichText(action.text || "");
  } else {
    shapeProps.richText = toRichText(action.text || "");
    shapeProps.w = action.props?.w || 150;
    shapeProps.h = action.props?.h || 100;
    shapeProps.geo = sanitizeGeo(action.props?.geo, "rectangle");
  }

  const newShape: Record<string, unknown> = {
    type: shapeType,
    x,
    y,
    props: shapeProps,
  };
  if (action.target_id) newShape.id = action.target_id;
  editor.createShape(newShape as TLShapePartial);
};

export const handleModifyShape: ActionHandler = (action, { editor }) => {
  if (!action.target_id) return;
  const targetId = action.target_id as TLShapeId;
  const currentShape = editor.getShape(targetId);
  if (!currentShape) return;

  const cleanProps = { ...action.props };
  if ("color" in cleanProps) {
    cleanProps.color = sanitizeColor(
      cleanProps.color,
      ((currentShape.props as unknown) as { color?: string }).color || "black"
    );
  }
  if ("geo" in cleanProps && currentShape.type === "geo") {
    cleanProps.geo = sanitizeGeo(
      cleanProps.geo,
      ((currentShape.props as unknown) as { geo?: string }).geo || "rectangle"
    );
  }

  if (currentShape.type === "note") {
    delete cleanProps.w;
    delete cleanProps.h;
    delete cleanProps.text;
    if (action.text !== undefined) cleanProps.richText = toRichText(action.text);
  } else {
    if (action.text !== undefined) cleanProps.richText = toRichText(action.text);
  }

  editor.updateShape({
    id: targetId,
    type: currentShape.type,
    props: filterValidProps(editor, currentShape.type, {
      ...currentShape.props,
      ...cleanProps,
    }),
  } as TLShapePartial);
};

export const handleDeleteShape: ActionHandler = (action, { editor }) => {
  if (!action.target_id) return;
  editor.deleteShape(action.target_id as TLShapeId);
};

export const handleAlignShapes: ActionHandler = (action, { editor }) => {
  const targetIds = ((action.props?.target_ids as string[]) || []).map((id) => id as TLShapeId);
  if (targetIds.length < 2) return;
  let alignment = (action.props?.alignment as string) || "center-horizontal";
  if (alignment === "center") alignment = "center-horizontal";
  if (alignment === "middle") alignment = "center-vertical";
  editor.alignShapes(targetIds, alignment as "top" | "left" | "right" | "bottom" | "center-horizontal" | "center-vertical");
};

export const handleLayerShape: ActionHandler = (action, { editor }) => {
  if (!action.target_id) return;
  const targetId = action.target_id as TLShapeId;
  const layerAction = action.props?.action as string;
  if (layerAction === "front") editor.bringToFront([targetId]);
  else if (layerAction === "back") editor.sendToBack([targetId]);
  else if (layerAction === "forward") editor.bringForward([targetId]);
  else if (layerAction === "backward") editor.sendBackward([targetId]);
};
