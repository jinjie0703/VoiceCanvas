import type { ActionHandler } from "../ActionEngine";
import { executeWithInterceptor } from "../../../utils/tldrawInterceptor";

export const handleClearCanvas: ActionHandler = (_action, { editor }) => {
  const allShapes = editor.getCurrentPageShapes();
  editor.deleteShapes(allShapes.map((s) => s.id));
};

export const handleNativeTldrawShape: ActionHandler = (action, { editor }) => {
  const nativeShape: Record<string, unknown> = { ...action.props };
  if (action.target_id) {
    nativeShape.id = action.target_id;
  }
  executeWithInterceptor(editor, nativeShape);
};

export const handleGroupShapes: ActionHandler = (action, { editor }) => {
  const targetIds = ((action.props?.target_ids as string[]) || []).map((id) => id as import("tldraw").TLShapeId);
  if (targetIds.length > 0) {
    editor.groupShapes(targetIds);
  }
};

export const handleSelectShapes: ActionHandler = (action, { editor }) => {
  const targetIds = ((action.props?.target_ids as string[]) || []).map((id) => id as import("tldraw").TLShapeId);
  editor.select(...targetIds);
};
