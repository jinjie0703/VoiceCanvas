import React, { useRef, useImperativeHandle, forwardRef } from "react";
import {
  Tldraw,
  Editor,
  renderPlaintextFromRichText,
} from "tldraw";
import "tldraw/tldraw.css";
import type { CanvasElement, DrawAction } from "../../types";
import { getSemanticPosition } from "../../utils/coords";
import { executeActionEngine } from "../../core/engine/ActionEngine";

interface WhiteboardProps {
  onMount?: (editor: Editor) => void;
  hideUi?: boolean;
}

export interface WhiteboardRef {
  getCanvasStateSnapshot: () => CanvasElement[];
  executeActions: (actions: DrawAction[]) => void;
  undo: () => void;
  redo: () => void;
}

export const Whiteboard = React.memo(
  forwardRef<WhiteboardRef, WhiteboardProps>(({ onMount, hideUi }, ref) => {
    const editorRef = useRef<Editor | null>(null);

    const getCanvasStateSnapshot = (): CanvasElement[] => {
      if (!editorRef.current) return [];

      const shapes = editorRef.current.getCurrentPageShapes();
      const canvasW = window.innerWidth;
      const canvasH = window.innerHeight;

      return shapes.map((s) => {
        const props = s.props as {
          richText?: Parameters<typeof renderPlaintextFromRichText>[1];
          text?: string;
          geo?: string;
          color?: string;
        };
        const textVal = props.richText
          ? renderPlaintextFromRichText(editorRef.current!, props.richText)
          : props.text || "";
        return {
          id: s.id,
          type: s.type,
          geo: props.geo || undefined,
          color: props.color || "black",
          position: getSemanticPosition(s.x, s.y, canvasW, canvasH),
          text: textVal,
        };
      });
    };

    const executeActions = (actions: DrawAction[]) => {
      const editor = editorRef.current;
      if (!editor) return;

      const canvasW = window.innerWidth;
      const canvasH = window.innerHeight;

      // Wrap the streamed chunks so TLDraw records them correctly in the history stack
      executeActionEngine(actions, { editor, canvasW, canvasH });
    };

    const undo = () => editorRef.current?.undo();
    const redo = () => editorRef.current?.redo();

    useImperativeHandle(ref, () => ({
      getCanvasStateSnapshot,
      executeActions,
      undo,
      redo,
    }));

    return (
      <Tldraw
        hideUi={hideUi ?? true}
        onMount={(editor) => {
          editorRef.current = editor;
          onMount?.(editor);
        }}
      />
    );
  })
);

Whiteboard.displayName = "Whiteboard";
