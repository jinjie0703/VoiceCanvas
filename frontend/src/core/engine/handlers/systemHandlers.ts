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
