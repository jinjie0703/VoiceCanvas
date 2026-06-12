import { create } from 'zustand';
import type { DebugLog } from '../types';

interface AppState {
  // UI State
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  isEditMode: boolean;
  
  // App Logic State
  statusText: string;
  transcript: string;
  debugLogs: DebugLog[];
  wsStatus: 'connected' | 'disconnected';

  // Actions
  setLeftPanelVisible: (visible: boolean) => void;
  setRightPanelVisible: (visible: boolean) => void;
  setIsEditMode: (mode: boolean) => void;
  setStatusText: (text: string) => void;
  setTranscript: (text: string) => void;
  addDebugLog: (log: DebugLog) => void;
  clearDebugLogs: () => void;
  setWsStatus: (status: 'connected' | 'disconnected') => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial State
  leftPanelVisible: true,
  rightPanelVisible: true,
  isEditMode: false,
  statusText: '等待指令',
  transcript: '尝试说些什么，例如：“在中心画一个红色圆圈”',
  debugLogs: [],
  wsStatus: 'disconnected',

  // Actions
  setLeftPanelVisible: (visible) => set({ leftPanelVisible: visible }),
  setRightPanelVisible: (visible) => set({ rightPanelVisible: visible }),
  setIsEditMode: (mode) => set({ isEditMode: mode }),
  setStatusText: (text) => set({ statusText: text }),
  setTranscript: (text) => set({ transcript: text }),
  addDebugLog: (log) => set((state) => ({ debugLogs: [log, ...state.debugLogs] })),
  clearDebugLogs: () => set({ debugLogs: [] }),
  setWsStatus: (status) => set({ wsStatus: status }),
}));
