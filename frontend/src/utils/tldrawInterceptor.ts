import type { Editor, TLShape } from "tldraw";
import {
  VALID_TLDRAW_COLORS,
  VALID_TLDRAW_DASHES,
  VALID_TLDRAW_FILLS,
  VALID_TLDRAW_SIZES,
  VALID_TLDRAW_ALIGNS,
  VALID_TLDRAW_FONTS,
} from "./constants";

/**
 * 预处理 shape 属性，修正 LLM 幻觉产生的非法枚举值。
 * 在 TLDraw 严格校验之前拦截，防止 Fatal Transaction Error。
 *
 * @param props - 原始的 shape 属性对象
 * @returns 修正后的安全属性对象
 */
function sanitizeShapeProps(props: Record<string, unknown>) {
  if (!props) return props;
  const clean = { ...props };
  
  // Auto-correct common color hallucinations
  if (typeof clean.color === 'string') {
    let c = clean.color.toLowerCase();
    if (c === 'purple') c = 'violet';
    if (c.includes('purple')) c = 'violet';
    if (c === 'gray') c = 'grey';
    if (c.includes('green') && c !== 'green' && c !== 'light-green') c = 'light-green';
    if (c.includes('red') && c !== 'red' && c !== 'light-red') c = 'light-red';
    if (c.includes('blue') && c !== 'blue' && c !== 'light-blue') c = 'light-blue';
    if (c.startsWith('#') || c.startsWith('rgb')) c = 'black'; // fallback for hex
    clean.color = c;
    if (!VALID_TLDRAW_COLORS.has(c)) delete clean.color;
  }

  // Auto-correct fill hallucinations
  if (typeof clean.fill === 'string') {
    const f = clean.fill.toLowerCase();
    // If AI hallucinates a color for fill, fix it
    if (VALID_TLDRAW_COLORS.has(f) || f === 'purple') {
      if (f === 'purple') clean.color = 'violet';
      else clean.color = f;
      clean.fill = 'solid'; // assume they wanted a solid color fill
    } else {
      if (!VALID_TLDRAW_FILLS.has(f)) {
        if (f.includes('semi') || f.includes('transparent')) clean.fill = 'semi';
        else if (f.includes('pattern') || f.includes('grid')) clean.fill = 'pattern';
        else if (f.includes('solid')) clean.fill = 'solid';
        else delete clean.fill;
      }
    }
  }

  if (typeof clean.dash === 'string' && !VALID_TLDRAW_DASHES.has(clean.dash)) delete clean.dash;
  if (typeof clean.size === 'string' && !VALID_TLDRAW_SIZES.has(clean.size)) delete clean.size;
  if (typeof clean.align === 'string' && !VALID_TLDRAW_ALIGNS.has(clean.align)) delete clean.align;
  if (typeof clean.font === 'string' && !VALID_TLDRAW_FONTS.has(clean.font)) delete clean.font;
  
  return clean;
}

/**
 * 根据 shape 类型的默认属性过滤非法键，再经过枚举值修正。
 * 防止 LLM 幻觉注入不存在的 prop key 导致 TLDraw 报错。
 *
 * @param editor - TLDraw Editor 实例
 * @param type - 目标 shape 类型名称
 * @param rawProps - LLM 输出的原始属性对象
 * @returns 过滤 + 修正后的安全属性对象
 */
export function filterValidProps(editor: Editor, type: string, rawProps: Record<string, unknown>) {
  const cleanProps: Record<string, unknown> = {};
  
  let util;
  try {
    util = editor.getShapeUtil(type as TLShape["type"]);
  } catch {
    console.warn(`[Interceptor] Unknown shape type '${type}', skipping prop filtering`);
  }

  let allowedKeys = new Set<string>();
  try {
    if (util && typeof util.getDefaultProps === 'function') {
      const defaultProps = util.getDefaultProps();
      allowedKeys = new Set(Object.keys(defaultProps));
    }
  } catch {
    console.warn(`[Interceptor] Failed to get default props for '${type}'`);
  }

  for (const key of Object.keys(rawProps)) {
    if (allowedKeys.size === 0 || allowedKeys.has(key)) {
      cleanProps[key] = rawProps[key];
    } else {
      console.warn(`[Interceptor] Stripped illegal hallucinated property '${key}' from shape type '${type}'`);
    }
  }

  return sanitizeShapeProps(cleanProps);
}

/**
 * 带拦截和降级回退的 shape 创建执行器。
 * 当 LLM 幻觉导致 TLDraw 校验失败时，自动剥离所有自定义属性并以默认值渲染。
 *
 * @param editor - TLDraw Editor 实例
 * @param shapePayload - LLM 生成的原始 shape 数据
 */
export const executeWithInterceptor = (editor: Editor, shapePayload: Record<string, unknown>) => {
  const shape = { ...shapePayload };
  
  // 1. Verify shape type exists, fallback to geo if unknown
  try {
    if (typeof shape.type === 'string') {
      const util = editor.getShapeUtil(shape.type as TLShape["type"]);
      if (!util) {
        shape.props = { ...(shape.props as Record<string, unknown> || {}), geo: shape.type };
        shape.type = 'geo';
      }
    }
  } catch {
    // Type not recognized, fallback to geo
    if (typeof shape.type === 'string') {
      shape.props = { ...(shape.props as Record<string, unknown> || {}), geo: shape.type };
      shape.type = 'geo';
    }
  }

  // 2. Pre-sanitize props to avoid throwing transaction errors
  if (shape.props && typeof shape.props === 'object') {
    shape.props = filterValidProps(editor, shape.type as string || 'geo', shape.props as Record<string, unknown>);
  }

  // 3. Try normal creation
  try {
    editor.createShape(shape as Parameters<Editor["createShape"]>[0]);
  } catch (err) {
    console.warn("TLDraw 验证失败，触发拦截器终极降级处理:", (err as Error).message);
    
    // 4. Fallback strategy: Strip all custom props and render with safe defaults
    if (shape.props) {
      const fallbackShape = { ...shape };
      delete fallbackShape.props; 
      try {
        editor.createShape(fallbackShape as Parameters<Editor["createShape"]>[0]);
        console.info("拦截器：已成功剥离非法属性并降级渲染。");
      } catch (fallbackErr) {
        console.error("拦截器：彻底无法挽救的异常数据", fallbackErr);
      }
    }
  }
};
