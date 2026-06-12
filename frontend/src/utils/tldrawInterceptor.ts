import type { Editor, TLShape } from "tldraw";

const VALID_COLORS = new Set(["black", "blue", "red", "green", "yellow", "orange", "light-blue", "light-green", "light-red", "grey", "violet"]);
const VALID_DASHES = new Set(["draw", "solid", "dashed", "dotted", "none"]);
const VALID_FILLS = new Set(["none", "semi", "solid", "pattern"]);
const VALID_SIZES = new Set(["s", "m", "l", "xl"]);
const VALID_ALIGNS = new Set(["start", "middle", "end", "justify", "start-legacy", "end-legacy", "center-legacy"]);
const VALID_FONTS = new Set(["draw", "sans", "serif", "mono"]);

/**
 * Pre-sanitizes the shape properties to ensure strict enum adherence,
 * preventing TLDraw's strict schema validators from throwing fatal errors.
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
    if (!VALID_COLORS.has(c)) delete clean.color;
  }

  // Auto-correct fill hallucinations
  if (typeof clean.fill === 'string') {
    const f = clean.fill.toLowerCase();
    // If AI hallucinates a color for fill, fix it
    if (VALID_COLORS.has(f) || f === 'purple') {
      if (f === 'purple') clean.color = 'violet';
      else clean.color = f;
      clean.fill = 'solid'; // assume they wanted a solid color fill
    } else {
      if (!VALID_FILLS.has(f)) {
        if (f.includes('semi') || f.includes('transparent')) clean.fill = 'semi';
        else if (f.includes('pattern') || f.includes('grid')) clean.fill = 'pattern';
        else if (f.includes('solid')) clean.fill = 'solid';
        else delete clean.fill;
      }
    }
  }

  if (typeof clean.dash === 'string' && !VALID_DASHES.has(clean.dash)) delete clean.dash;
  if (typeof clean.size === 'string' && !VALID_SIZES.has(clean.size)) delete clean.size;
  if (typeof clean.align === 'string' && !VALID_ALIGNS.has(clean.align)) delete clean.align;
  if (typeof clean.font === 'string' && !VALID_FONTS.has(clean.font)) delete clean.font;
  
  return clean;
}

export function filterValidProps(editor: Editor, type: string, rawProps: Record<string, unknown>) {
  const cleanProps: Record<string, unknown> = {};
  
  let util;
  try {
    util = editor.getShapeUtil(type as TLShape["type"]);
  } catch {
    // Ignore
  }

  let allowedKeys = new Set<string>();
  try {
    if (util && typeof util.getDefaultProps === 'function') {
      const defaultProps = util.getDefaultProps();
      allowedKeys = new Set(Object.keys(defaultProps));
    }
  } catch {
    // Ignore
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
 * Executes a shape creation with dynamic interception and fallback.
 * Prevents TLDraw validation errors from crashing the app due to AI hallucinations.
 */
export const executeWithInterceptor = (editor: Editor, shapePayload: Record<string, unknown>) => {
  const shape = { ...shapePayload };
  
  let util;
  try {
    if (typeof shape.type === 'string') {
      util = editor.getShapeUtil(shape.type as TLShape["type"]);
      if (!util) {
        shape.props = { ...(shape.props as Record<string, unknown> || {}), geo: shape.type };
        shape.type = 'geo';
      }
    }
  } catch {
    // Ignore if getShapeUtil fails
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
