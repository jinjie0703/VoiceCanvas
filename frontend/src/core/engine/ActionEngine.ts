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
import { handleClearCanvas, handleNativeTldrawShape } from "./handlers/systemHandlers";

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
};

export const executeActionEngine = (actions: DrawAction[], context: ActionContext) => {
  actions.forEach((action) => {
    try {
      if (!action.command) return;
      const handler = handlers[action.command];
      if (handler) {
        handler(action, context);
      } else {
        console.warn(`[ActionEngine] Unrecognized command: ${action.command}`);
      }
    } catch (e) {
      console.error("[ActionEngine] Failed executing action:", action, e);
    }
  });

  setTimeout(() => {
    context.editor.zoomToFit({ animation: { duration: 300 } });
  }, 150);
};
