import { toRichText, createShapeId, AssetRecordType } from "tldraw";
import type { TLShapePartial } from "tldraw";
import type { ActionHandler } from "../ActionEngine";
import { getCoordsFromSemantic } from "../../../utils/coords";
import { filterValidProps } from "../../../utils/tldrawInterceptor";

export const handleCreateSvg: ActionHandler = (action, { editor, canvasW, canvasH }) => {
  const svgCode = action.props?.svgCode as string;
  if (!svgCode) return;

  let x, y;
  if (typeof action.x === "number" && typeof action.y === "number") {
    x = canvasW / 2 + action.x;
    y = canvasH / 2 + action.y;
  } else {
    const coords = getCoordsFromSemantic(action.position || "center", canvasW, canvasH);
    x = coords.x;
    y = coords.y;
  }

  const w = (action.props?.w as number) || 300;
  const h = (action.props?.h as number) || 300;
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
  editor.createShape(newImgShape as TLShapePartial);
};

export const handleCreateImage: ActionHandler = (action, { editor, canvasW, canvasH }) => {
  const url = action.props?.url as string;
  if (!url) return;

  let x, y;
  if (typeof action.x === "number" && typeof action.y === "number") {
    x = canvasW / 2 + action.x;
    y = canvasH / 2 + action.y;
  } else {
    const coords = getCoordsFromSemantic(action.position || "center", canvasW, canvasH);
    x = coords.x;
    y = coords.y;
  }

  const w = (action.props?.w as number) || 400;
  const h = (action.props?.h as number) || 400;

  const assetId = AssetRecordType.createId();
  const placeholderId = createShapeId();
  
  editor.createShape({
    id: placeholderId,
    type: "note",
    x,
    y,
    props: filterValidProps(editor, "note", {
      color: "light-blue",
      richText: toRichText("⏳ 正在调用大模型生成图片，可能需要 10-20 秒，请稍候..."),
    }),
  } as TLShapePartial);

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
      props: { w, h, assetId },
    };
    if (action.target_id) newImgShape.id = action.target_id;
    
    editor.createShape(newImgShape as TLShapePartial);
    editor.deleteShape(placeholderId);
  };
  img.onerror = (err) => {
    console.error("Failed to load AI image:", err);
    editor.updateShape({
      id: placeholderId,
      type: "note",
      props: filterValidProps(editor, "note", {
        color: "light-red",
        richText: toRichText("❌ 图片生成失败，可能是网络跨域拦截或接口超时。"),
      }),
    } as TLShapePartial);
  };
  img.src = url;
};
