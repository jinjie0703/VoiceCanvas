import { useRef, useImperativeHandle, forwardRef } from "react";
import {
  Tldraw,
  Editor,
  toRichText,
  renderPlaintextFromRichText,
  createShapeId,
  createBindingId,
  AssetRecordType,
} from "tldraw";
import type { TLShapeId } from "tldraw";
import "tldraw/tldraw.css";
import type { CanvasElement, DrawAction } from "../types";
import { getSemanticPosition, getCoordsFromSemantic } from "../utils/coords";
import { executeWithInterceptor, filterValidProps } from "../utils/tldrawInterceptor";

interface WhiteboardProps {
  onMount?: (editor: Editor) => void;
  hideUi?: boolean;
}

export interface WhiteboardRef {
  getCanvasStateSnapshot: () => CanvasElement[];
  executeActions: (actions: DrawAction[]) => void;
}

// Bulletproof property sanitizers for TLDraw API
const sanitizeColor = (color: unknown, defaultColor: string): string => {
  if (!color || typeof color !== "string") return defaultColor;
  const lowerColor = color.toLowerCase();
  if (lowerColor === "gray") return "grey";

  const validColors = [
    "black",
    "grey",
    "light-violet",
    "violet",
    "blue",
    "light-blue",
    "yellow",
    "orange",
    "green",
    "light-green",
    "light-red",
    "red",
    "white",
  ];
  if (validColors.includes(lowerColor)) return lowerColor;
  return defaultColor;
};

const sanitizeGeo = (geo: unknown, defaultGeo: string): string => {
  if (!geo || typeof geo !== "string") return defaultGeo;
  const lowerGeo = geo.toLowerCase();
  if (lowerGeo === "circle") return "ellipse";
  if (lowerGeo === "square") return "rectangle";

  const validGeos = [
    "rectangle",
    "ellipse",
    "triangle",
    "diamond",
    "pentagon",
    "hexagon",
    "octagon",
    "star",
    "rhombus",
    "oval",
    "cloud",
  ];
  if (validGeos.includes(lowerGeo)) return lowerGeo;
  return defaultGeo;
};

export const Whiteboard = forwardRef<WhiteboardRef, WhiteboardProps>(
  ({ onMount, hideUi }, ref) => {
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

      actions.forEach((action) => {
        try {
          if (!action.command) return;
          if (action.command === "create_shape") {
            let x, y;
            if (typeof action.x === "number" && typeof action.y === "number") {
              x = canvasW / 2 + action.x;
              y = canvasH / 2 + action.y;
            } else {
              const coords = getCoordsFromSemantic(
                action.position || "center",
                canvasW,
                canvasH,
              );
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
              x: x,
              y: y,
              props: shapeProps,
            };
            if (action.target_id) {
              newShape.id = action.target_id;
            }
            editor.createShape(
              newShape as Parameters<Editor["createShape"]>[0],
            );
          } else if (action.command === "modify_shape") {
            if (!action.target_id) return;
            const targetId = action.target_id as TLShapeId;
            const currentShape = editor.getShape(targetId);
            if (!currentShape) return;

            const cleanProps = { ...action.props };
            if ("color" in cleanProps) {
              cleanProps.color = sanitizeColor(
                cleanProps.color,
                (currentShape.props as { color?: string }).color || "black",
              );
            }
            if ("geo" in cleanProps && currentShape.type === "geo") {
              cleanProps.geo = sanitizeGeo(
                cleanProps.geo,
                (currentShape.props as { geo?: string }).geo || "rectangle",
              );
            }

            if (currentShape.type === "note") {
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
              props: filterValidProps(editor, currentShape.type, {
                ...currentShape.props,
                ...cleanProps,
              }),
            } as Parameters<Editor["updateShape"]>[0]);
          } else if (action.command === "delete_shape") {
            if (!action.target_id) return;
            editor.deleteShape(action.target_id as TLShapeId);
          } else if (action.command === "clear_canvas") {
            const allShapes = editor.getCurrentPageShapes();
            editor.deleteShapes(allShapes.map((s) => s.id));
          } else if (action.command === "create_svg") {
            const svgCode = action.props?.svgCode as string;
            if (!svgCode) return;

            let x, y;
            if (typeof action.x === "number" && typeof action.y === "number") {
              x = canvasW / 2 + action.x;
              y = canvasH / 2 + action.y;
            } else {
              const coords = getCoordsFromSemantic(
                action.position || "center",
                canvasW,
                canvasH,
              );
              x = coords.x;
              y = coords.y;
            }

            const w = (action.props?.w as number) || 300;
            const h = (action.props?.h as number) || 300;

            const svgDataUrl =
              "data:image/svg+xml;utf8," + encodeURIComponent(svgCode);

            const assetId = AssetRecordType.createId();
            editor.store.put([
              {
                id: assetId,
                typeName: "asset",
                type: "image",
                props: {
                  w,
                  h,
                  name: "ai-generated-svg",
                  isAnimated: false,
                  mimeType: "image/svg+xml",
                  src: svgDataUrl,
                },
                meta: {},
              },
            ]);

            const newImgShape: Record<string, unknown> = {
              type: "image",
              x,
              y,
              props: {
                w,
                h,
                assetId,
              },
            };
            if (action.target_id) {
              newImgShape.id = action.target_id;
            }
            editor.createShape(
              newImgShape as Parameters<Editor["createShape"]>[0],
            );
          } else if (action.command === "create_image") {
            const url = action.props?.url as string;
            if (!url) return;

            let x, y;
            if (typeof action.x === "number" && typeof action.y === "number") {
              x = canvasW / 2 + action.x;
              y = canvasH / 2 + action.y;
            } else {
              const coords = getCoordsFromSemantic(
                action.position || "center",
                canvasW,
                canvasH,
              );
              x = coords.x;
              y = coords.y;
            }

            const w = (action.props?.w as number) || 400;
            const h = (action.props?.h as number) || 400;

            const assetId = AssetRecordType.createId();
            const placeholderId = createShapeId();
            
            // 1. 创建占位符，缓解用户的等待焦虑
            editor.createShape({
              id: placeholderId,
              type: "note",
              x,
              y,
              props: filterValidProps(editor, "note", {
                color: "light-blue",
                richText: toRichText("⏳ 正在调用大模型生成图片，可能需要 10-20 秒，请稍候..."),
              }),
            } as Parameters<Editor["createShape"]>[0]);

            // 2. 异步预加载图片
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              editor.createAssets([
                {
                  id: assetId,
                  typeName: "asset",
                  type: "image",
                  props: {
                    w: img.naturalWidth || w,
                    h: img.naturalHeight || h,
                    name: "ai-generated-image",
                    isAnimated: false,
                    mimeType: "image/jpeg",
                    src: url,
                  },
                  meta: {},
                },
              ]);

              const newImgShape: Record<string, unknown> = {
                type: "image",
                x,
                y,
                props: {
                  w,
                  h,
                  assetId,
                },
              };
              if (action.target_id) {
                newImgShape.id = action.target_id;
              }
              
              // 3. 画出真正的图片
              editor.createShape(
                newImgShape as Parameters<Editor["createShape"]>[0],
              );
              
              // 4. 删掉占位符
              editor.deleteShape(placeholderId);
            };
            img.onerror = (err) => {
              console.error("Failed to load AI image:", err);
              // 5. 失败反馈
              editor.updateShape({
                id: placeholderId,
                type: "note",
                props: filterValidProps(editor, "note", {
                  color: "light-red",
                  richText: toRichText("❌ 图片生成失败，可能是网络跨域拦截或接口超时。"),
                }),
              } as Parameters<Editor["updateShape"]>[0]);
            };
            img.src = url;
          } else if (action.command === "native_tldraw_shape") {
            const nativeShape: Record<string, unknown> = { ...action.props };
            if (action.target_id) {
              nativeShape.id = action.target_id;
            }
            executeWithInterceptor(editor, nativeShape);
          } else if (action.command === "create_connection") {
            const startId = action.props?.start_id as TLShapeId | undefined;
            const endId = action.props?.end_id as TLShapeId | undefined;
            if (!startId || !endId) return;

            // Safe guard: check if shapes exist before binding
            if (!editor.getShape(startId)) return;
            if (!editor.getShape(endId)) return;

            const arrowId = createShapeId();
            
            const arrowProps = filterValidProps(editor, "arrow", {
              richText: toRichText(action.text || ""),
              color: action.props?.color || "black",
              bend: 40,
            });

            editor.createShape({
              id: arrowId,
              type: "arrow",
              x: 0,
              y: 0,
              props: arrowProps,
            } as Parameters<Editor["createShape"]>[0]);

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
          } else if (action.command === "align_shapes") {
            const targetIds = (
              (action.props?.target_ids as string[]) || []
            ).map((id) => id as TLShapeId);
            if (targetIds.length < 2) return;
            const alignment =
              (action.props?.alignment as
                | "left"
                | "center-horizontal"
                | "right"
                | "center-vertical"
                | "top"
                | "bottom") || "left";
            editor.alignShapes(targetIds, alignment);
          } else if (action.command === "layer_shape") {
            if (!action.target_id) return;
            const targetId = action.target_id as TLShapeId;
            const layerAction = action.props?.action as
              | "front"
              | "back"
              | "forward"
              | "backward";
            if (layerAction === "front") {
              editor.bringToFront([targetId]);
            } else if (layerAction === "back") {
              editor.sendToBack([targetId]);
            } else if (layerAction === "forward") {
              editor.bringForward([targetId]);
            } else if (layerAction === "backward") {
              editor.sendBackward([targetId]);
            }
          }
        } catch (e) {
          console.error("Failed executing action:", action, e);
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
        hideUi={hideUi ?? true}
        onMount={(editor) => {
          editorRef.current = editor;
          onMount?.(editor);
        }}
      />
    );
  },
);

Whiteboard.displayName = "Whiteboard";
