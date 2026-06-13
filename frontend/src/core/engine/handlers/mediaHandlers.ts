import { toRichText, createShapeId, AssetRecordType } from "tldraw";
import type { ActionHandler } from "../ActionEngine";
import { resolveActionCoords } from "../../../utils/coords";
import { filterValidProps, executeWithInterceptor, executeUpdateWithInterceptor } from "../../../utils/tldrawInterceptor";
import { sanitizeNumber } from "../../../utils/sanitizers";

/**
 * 处理 create_svg 指令：将 SVG 代码作为图片资源嵌入画布。
 * 通过 Data URL 编码，避免外部请求。
 */
export const handleCreateSvg: ActionHandler = (action, { editor, canvasW, canvasH }) => {
  const svgCode = action.props?.svgCode as string;
  if (!svgCode) return;

  const { x, y } = resolveActionCoords(action, canvasW, canvasH);

  const w = sanitizeNumber(action.props?.w, 300);
  const h = sanitizeNumber(action.props?.h, 300);
  const svgDataUrl = "data:image/svg+xml;utf8," + encodeURIComponent(svgCode);
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
    props: { w, h, assetId },
  };
  if (action.target_id) newImgShape.id = action.target_id;
  executeWithInterceptor(editor, newImgShape);
};

/**
 * 处理 create_image 指令：从 URL 异步加载图片并嵌入画布。
 * 返回 Promise，确保 ActionEngine 在图片加载完成后再 zoomToFit。
 * 加载期间显示占位 note，加载失败时原地展示错误提示。
 */
export const handleCreateImage: ActionHandler = (action, { editor, canvasW, canvasH }): Promise<void> => {
  const url = action.props?.url as string;
  if (!url) return Promise.resolve();

  const { x, y } = resolveActionCoords(action, canvasW, canvasH);

  const w = sanitizeNumber(action.props?.w, 400);
  const h = sanitizeNumber(action.props?.h, 400);

  const assetId = AssetRecordType.createId();
  const placeholderId = createShapeId();
  
  executeWithInterceptor(editor, {
    id: placeholderId,
    type: "note",
    x,
    y,
    props: filterValidProps(editor, "note", {
      color: "light-blue",
      richText: toRichText("⏳ 正在调用大模型生成图片，可能需要 10-20 秒，请稍候..."),
    }),
  });

  return new Promise<void>((resolve) => {
    let isResolved = false;
    const finish = () => {
      if (isResolved) return;
      isResolved = true;
      resolve();
    };

    const timeoutId = setTimeout(() => {
      if (isResolved) return;
      console.warn("Image loading timed out after 30s");
      executeUpdateWithInterceptor(editor, {
        id: placeholderId,
        type: "note",
        props: filterValidProps(editor, "note", {
          color: "light-red",
          richText: toRichText("❌ 图片加载超时，请检查网络连接。"),
        }),
      });
      finish();
    }, 30000);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (isResolved) return;
      clearTimeout(timeoutId);
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
        props: { w, h, assetId },
      };
      if (action.target_id) newImgShape.id = action.target_id;
      
      executeWithInterceptor(editor, newImgShape);
      editor.deleteShape(placeholderId);
      finish();
    };
    img.onerror = (err) => {
      if (isResolved) return;
      clearTimeout(timeoutId);
      console.error("Failed to load AI image:", err);
      executeUpdateWithInterceptor(editor, {
        id: placeholderId,
        type: "note",
        props: filterValidProps(editor, "note", {
          color: "light-red",
          richText: toRichText("❌ 图片生成失败，可能是网络跨域拦截或接口超时。"),
        }),
      });
      finish(); // 即使失败也 resolve，不阻塞后续 action
    };
    img.src = url;
  });
};
