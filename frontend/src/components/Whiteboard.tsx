import { useRef, useImperativeHandle, forwardRef } from 'react';
import { Tldraw, Editor, toRichText, renderPlaintextFromRichText } from 'tldraw';
import type { TLShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import type { CanvasElement, DrawAction } from '../types';
import { getSemanticPosition, getCoordsFromSemantic } from '../utils/coords';

interface WhiteboardProps {
  onMount?: (editor: Editor) => void;
}

export interface WhiteboardRef {
  getCanvasStateSnapshot: () => CanvasElement[];
  executeActions: (actions: DrawAction[]) => void;
}

export const Whiteboard = forwardRef<WhiteboardRef, WhiteboardProps>(({ onMount }, ref) => {
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
      const textVal = s.type === 'note'
        ? (props.richText ? renderPlaintextFromRichText(editorRef.current!, props.richText) : '')
        : (props.text || '');
      return {
        id: s.id,
        type: s.type,
        geo: props.geo || undefined,
        color: props.color || 'black',
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

    actions.forEach((action) => {
      try {
        if (action.command === 'create_shape') {
          const { x, y } = getCoordsFromSemantic(action.position || 'center', canvasW, canvasH);
          const shapeType = action.type === 'note' ? 'note' : 'geo';
          
          const shapeProps: Record<string, unknown> = {
            color: action.props?.color || (shapeType === 'note' ? 'yellow' : 'blue'),
          };

          if (shapeType === 'note') {
            shapeProps.richText = toRichText(action.text || '');
          } else {
            shapeProps.text = action.text || '';
            shapeProps.w = action.props?.w || 150;
            shapeProps.h = action.props?.h || 100;
            shapeProps.geo = action.props?.geo || 'rectangle';
          }
          
          editor.createShape({
            type: shapeType,
            x: x,
            y: y,
            props: shapeProps,
          } as Parameters<Editor['createShape']>[0]);
        } else if (action.command === 'modify_shape') {
          if (!action.target_id) return;
          const targetId = action.target_id as TLShapeId;
          const currentShape = editor.getShape(targetId);
          if (!currentShape) return;
          
          const cleanProps = { ...action.props };
          if (currentShape.type === 'note') {
            delete cleanProps.w;
            delete cleanProps.h;
            delete cleanProps.text;
            if (action.text !== undefined) {
              cleanProps.richText = toRichText(action.text);
            }
          } else {
            if (action.text !== undefined) {
              cleanProps.text = action.text;
            }
          }

          editor.updateShape({
            id: targetId,
            type: currentShape.type,
            props: {
              ...currentShape.props,
              ...cleanProps,
            },
          } as Parameters<Editor['updateShape']>[0]);
        } else if (action.command === 'delete_shape') {
          if (!action.target_id) return;
          editor.deleteShape(action.target_id as TLShapeId);
        } else if (action.command === 'clear_canvas') {
          const allShapes = editor.getCurrentPageShapes();
          editor.deleteShapes(allShapes.map((s) => s.id));
        }
      } catch (e) {
        console.error('Failed executing action:', action, e);
      }
    });

    // Auto-fit shapes nicely on screen with animation
    setTimeout(() => {
      editor.zoomToFit({ animation: { duration: 300 } });
    }, 150);
  };

  useImperativeHandle(ref, () => ({
    getCanvasStateSnapshot,
    executeActions,
  }));

  return (
    <Tldraw
      hideUi
      onMount={(editor) => {
        editorRef.current = editor;
        onMount?.(editor);
      }}
    />
  );
});

Whiteboard.displayName = 'Whiteboard';
