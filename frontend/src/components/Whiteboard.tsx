import { useRef, useImperativeHandle, forwardRef } from 'react';
import { Tldraw, Editor, toRichText, renderPlaintextFromRichText, createShapeId, createBindingId, AssetRecordType } from 'tldraw';
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
      const textVal = props.richText 
        ? renderPlaintextFromRichText(editorRef.current!, props.richText) 
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
            shapeProps.richText = toRichText(action.text || '');
            shapeProps.w = action.props?.w || 150;
            shapeProps.h = action.props?.h || 100;
            shapeProps.geo = action.props?.geo || 'rectangle';
          }
          
          const shapeId = action.target_id ? (action.target_id as TLShapeId) : undefined;
          editor.createShape({
            id: shapeId,
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
              cleanProps.richText = toRichText(action.text);
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
        } else if (action.command === 'create_svg') {
          const svgCode = action.props?.svgCode as string;
          if (!svgCode) return;
          const { x, y } = getCoordsFromSemantic(action.position || 'center', canvasW, canvasH);
          const w = (action.props?.w as number) || 300;
          const h = (action.props?.h as number) || 300;

          const svgDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgCode);
          
          const assetId = AssetRecordType.createId();
          editor.store.put([{
            id: assetId,
            typeName: 'asset',
            type: 'image',
            props: {
              w,
              h,
              name: 'ai-generated-svg',
              isAnimated: false,
              mimeType: 'image/svg+xml',
              src: svgDataUrl,
            },
            meta: {},
          }]);

          const shapeId = action.target_id ? (action.target_id as TLShapeId) : undefined;
          editor.createShape({
            id: shapeId,
            type: 'image',
            x,
            y,
            props: {
              w,
              h,
              assetId,
            },
          } as Parameters<Editor['createShape']>[0]);
        } else if (action.command === 'create_connection') {
          const startId = action.props?.start_id as TLShapeId | undefined;
          const endId = action.props?.end_id as TLShapeId | undefined;
          if (!startId || !endId) return;

          const arrowId = createShapeId();
          editor.createShape({
            id: arrowId,
            type: 'arrow',
            x: 0,
            y: 0,
            props: {
              start: { x: 0, y: 0 },
              end: { x: 100, y: 100 },
              richText: toRichText(action.text || ''),
              color: (action.props?.color as 'black' | 'red' | 'blue' | 'green' | 'orange' | 'yellow') || 'black',
              bend: 40,
            },
          } as Parameters<Editor['createShape']>[0]);

          editor.createBinding({
            id: createBindingId(),
            type: 'arrow' as const,
            fromId: arrowId,
            toId: startId,
            props: {
              terminal: 'start' as const,
              normalizedAnchor: { x: 0.5, y: 0.5 },
              isPrecise: false,
              isExact: false,
            },
          });

          editor.createBinding({
            id: createBindingId(),
            type: 'arrow' as const,
            fromId: arrowId,
            toId: endId,
            props: {
              terminal: 'end' as const,
              normalizedAnchor: { x: 0.5, y: 0.5 },
              isPrecise: false,
              isExact: false,
            },
          });
        } else if (action.command === 'align_shapes') {
          const targetIds = (action.props?.target_ids as string[] || []).map((id) => id as TLShapeId);
          if (targetIds.length < 2) return;
          const alignment = (action.props?.alignment as 'left' | 'center-horizontal' | 'right' | 'center-vertical' | 'top' | 'bottom') || 'left';
          editor.alignShapes(targetIds, alignment);
        } else if (action.command === 'layer_shape') {
          if (!action.target_id) return;
          const targetId = action.target_id as TLShapeId;
          const layerAction = action.props?.action as 'front' | 'back' | 'forward' | 'backward';
          if (layerAction === 'front') {
            editor.bringToFront([targetId]);
          } else if (layerAction === 'back') {
            editor.sendToBack([targetId]);
          } else if (layerAction === 'forward') {
            editor.bringForward([targetId]);
          } else if (layerAction === 'backward') {
            editor.sendBackward([targetId]);
          }
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
