export interface CanvasElement {
  id: string;
  type: string;
  geo?: string;
  color: string;
  position: string;
  text?: string;
}

export interface DrawAction {
  command: string;
  type?: string;
  target_id?: string;
  props?: Record<string, unknown>;
  position?: string;
  text?: string;
}

export interface ServerResponse {
  task_analysis?: string;
  step_by_step_plan?: string[];
  actions: DrawAction[];
  raw_text?: string;
}

export interface DebugLog {
  timestamp: string;
  rawText: string;
  taskAnalysis?: string;
  plan?: string[];
  actions: DrawAction[];
}
