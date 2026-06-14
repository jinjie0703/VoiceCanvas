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
  executeActions: (actions: DrawAction[]) => Promise<string[]>;
  exportSnapshotAsBase64: () => Promise<string | undefined>;
  undo: () => void;
  redo: () => void;
}

export const Whiteboard = React.memo(
  forwardRef<WhiteboardRef, WhiteboardProps>(({ onMount, hideUi }, ref) => {
    const editorRef = useRef<Editor | null>(null);

    const getCanvasStateSnapshot = (): CanvasElement[] => {
      if (!editorRef.current) return [];

      const shapes = editorRef.current.getCurrentPageShapes();
      const viewport = editorRef.current.getViewportScreenBounds();
      const canvasW = viewport.w;
      const canvasH = viewport.h;

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
        
        const bounds = editorRef.current!.getShapePageBounds(s.id);

        return {
          id: s.id,
          type: s.type,
          geo: props.geo || undefined,
          color: props.color || "black",
          position: getSemanticPosition(s.x, s.y, canvasW, canvasH),
          x: s.x,
          y: s.y,
          w: bounds?.w,
          h: bounds?.h,
          text: textVal,
        };
      });
    };

    const executeActions = async (actions: DrawAction[]): Promise<string[]> => {
      const editor = editorRef.current;
      if (!editor) return [];

      const viewport = editor.getViewportScreenBounds();
      const canvasW = viewport.w;
      const canvasH = viewport.h;

      return executeActionEngine(actions, { editor, canvasW, canvasH });
    };

    const undo = () => editorRef.current?.undo();
    const redo = () => editorRef.current?.redo();

    const exportSnapshotAsBase64 = async (): Promise<string | undefined> => {
      const editor = editorRef.current;
      if (!editor) return undefined;

      try {
        const shapeIds = editor.getCurrentPageShapeIds();
        if (shapeIds.size === 0) return undefined;

        const result = await editor.toImage(Array.from(shapeIds), {
          format: "jpeg", // Use JPEG instead of PNG to drastically reduce size and prevent OOM
          quality: 0.6,   // 60% quality is plenty for LLM visual reasoning
          scale: 0.8,     // Slight downscale to further reduce memory footprint
          padding: 16,
          background: true,
        });

        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            resolve(base64);
          };
          reader.readAsDataURL(result.blob);
        });
      } catch (e) {
        console.error("Failed to export canvas screenshot:", e);
        return undefined;
      }
    };

    useImperativeHandle(ref, () => ({
      getCanvasStateSnapshot,
      executeActions,
      exportSnapshotAsBase64,
      undo,
      redo,
    }));

    return (
      <Tldraw
        persistenceKey="voice-canvas-local-store"
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
