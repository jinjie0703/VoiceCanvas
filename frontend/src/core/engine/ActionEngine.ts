import type { Editor } from "tldraw";
import type { DrawAction } from "../../types";

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

export interface ActionContext {
  editor: Editor;
  canvasW: number;
  canvasH: number;
}

export type ActionHandler = (action: DrawAction, context: ActionContext) => void;

const handlers: Record<string, ActionHandler> = {
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

export const executeActionEngine = (actions: DrawAction[], context: ActionContext): string[] => {
  const errors: string[] = [];
  actions.forEach((action) => {
    try {
      if (!action.command) return;
      const handler = handlers[action.command];
      if (handler) {
        handler(action, context);
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
  });

  setTimeout(() => {
    context.editor.zoomToFit({ animation: { duration: 300 } });
  }, 150);

  return errors;
};
