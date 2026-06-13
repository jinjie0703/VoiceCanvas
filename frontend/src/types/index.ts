import { z } from "zod";

/**
 * 合法的 AI 绘制指令类型。
 * 与 ActionEngine handler 注册表严格对齐，新增指令时须同步更新。
 */
export const DrawCommandSchema = z.enum([
  "create_shape",
  "modify_shape",
  "delete_shape",
  "align_shapes",
  "layer_shape",
  "create_svg",
  "create_image",
  "create_connection",
  "clear_canvas",
  "native_tldraw_shape",
  "group_shapes",
  "select_shapes",
]);

export type DrawCommand = z.infer<typeof DrawCommandSchema>;

/** 九宫格语义方位（含 top_center / bottom_center） */
export const SemanticPositionSchema = z.enum([
  "top_left",
  "top_center",
  "top_right",
  "center_left",
  "center",
  "center_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
]);

export type SemanticPosition = z.infer<typeof SemanticPositionSchema>;

export const CanvasElementSchema = z.object({
  id: z.string(),
  type: z.string(),
  geo: z.string().optional(),
  color: z.string(),
  position: SemanticPositionSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
  text: z.string().optional(),
});

export type CanvasElement = z.infer<typeof CanvasElementSchema>;

export const DrawActionSchema = z.object({
  command: DrawCommandSchema,
  type: z.string().optional(),
  target_id: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  position: z.string().optional(),
  x: z.number().safe().optional(),
  y: z.number().safe().optional(),
  text: z.string().optional(),
}).catchall(z.unknown()); // Allow extra properties just in case, but enforce standard ones

export type DrawAction = z.infer<typeof DrawActionSchema>;

export const ServerResponseSchema = z.object({
  task_analysis: z.any().transform(v => typeof v === 'string' ? v : undefined).optional(),
  step_by_step_plan: z.any().transform(v => Array.isArray(v) ? v.filter(i => typeof i === 'string') : undefined).optional(),
  actions: z.any().transform(v => {
    if (!Array.isArray(v)) return [];
    return v.map(item => {
      const res = DrawActionSchema.safeParse(item);
      return res.success ? res.data : null;
    }).filter(Boolean) as DrawAction[];
  }).default([]),
  raw_text: z.any().transform(v => typeof v === 'string' ? v : undefined).optional(),
  feedback: z.any().transform(v => typeof v === 'string' ? v : undefined).optional(),
  voice_reply: z.any().transform(v => typeof v === 'string' ? v : undefined).optional(),
}).catchall(z.unknown());

export type ServerResponse = z.infer<typeof ServerResponseSchema>;

export interface DebugLog {
  timestamp: string;
  rawText: string;
  taskAnalysis?: string;
  plan?: string[];
  actions: DrawAction[];
  feedback?: string;
  voiceReply?: string;
}

