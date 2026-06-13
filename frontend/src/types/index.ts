/**
 * 合法的 AI 绘制指令类型。
 * 与 ActionEngine handler 注册表严格对齐，新增指令时须同步更新。
 */
export type DrawCommand =
  | "create_shape"
  | "modify_shape"
  | "delete_shape"
  | "align_shapes"
  | "layer_shape"
  | "create_svg"
  | "create_image"
  | "create_connection"
  | "clear_canvas"
  | "native_tldraw_shape"
  | "group_shapes"
  | "select_shapes";

/** 九宫格语义方位（含 top_center / bottom_center） */
export type SemanticPosition =
  | "top_left"
  | "top_center"
  | "top_right"
  | "center_left"
  | "center"
  | "center_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right";

export interface CanvasElement {
  id: string;
  type: string;
  geo?: string;
  color: string;
  position: SemanticPosition;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
}

export interface DrawAction {
  command: DrawCommand;
  type?: string;
  target_id?: string;
  props?: Record<string, unknown>;
  position?: string;
  x?: number;
  y?: number;
  text?: string;
}

export interface ServerResponse {
  task_analysis?: string;
  step_by_step_plan?: string[];
  actions: DrawAction[];
  raw_text?: string;
  feedback?: string;
  voice_reply?: string;
}

export interface DebugLog {
  timestamp: string;
  rawText: string;
  taskAnalysis?: string;
  plan?: string[];
  actions: DrawAction[];
  feedback?: string;
  voiceReply?: string;
}
