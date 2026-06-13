import { useRef, useState, useEffect } from "react";
import { Button, ConfigProvider, theme, Tooltip, message } from "antd";
import {
  SettingOutlined,
  HistoryOutlined,
  EditOutlined,
  AudioOutlined,
} from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import { useWebSocket } from "../../services/websocket/useWebSocket";
import { useSpeechRecognition } from "../../services/speech/useSpeechRecognition";
import { useTTS } from "../../services/speech/useTTS";
import { ControlPanel } from "../panels/ControlPanel";
import { DebugLogs } from "../panels/DebugLogs";
import { HelpPanel } from "../panels/HelpPanel";
import { Whiteboard } from "../canvas/Whiteboard";
import type { WhiteboardRef } from "../canvas/Whiteboard";
import type { DebugLog, ServerResponse, CanvasElement } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import { ErrorBoundary } from "./ErrorBoundary";

export default function AppLayout() {
  const setStatusText = useAppStore((state) => state.setStatusText);
  const setTranscript = useAppStore((state) => state.setTranscript);
  const addDebugLog = useAppStore((state) => state.addDebugLog);

  const leftPanelVisible = useAppStore((state) => state.leftPanelVisible);
  const setLeftPanelVisible = useAppStore((state) => state.setLeftPanelVisible);
  const rightPanelVisible = useAppStore((state) => state.rightPanelVisible);
  const setRightPanelVisible = useAppStore(
    (state) => state.setRightPanelVisible,
  );
  const isEditMode = useAppStore((state) => state.isEditMode);
  const setIsEditMode = useAppStore((state) => state.setIsEditMode);
  const wsStatus = useAppStore((state) => state.wsStatus);

  // 用户微调区：TLDraw 左下角 Tag 的展开状态（可随时通过代码微调高度）
  const [isTagExpanded, setIsTagExpanded] = useState(false);
  const BOTTOM_IDLE = "16px"; // 非编辑模式（全收起）
  const BOTTOM_EDIT_COLLAPSED = "56px"; // 编辑模式（Tag 未展开）
  const BOTTOM_EDIT_EXPANDED = "152px"; // 编辑模式（Tag 已展开）

  // 自动侦听 TLDraw 的原生 DOM，以精确捕获 Tag 展开状态
  useEffect(() => {
    if (!isEditMode) return;

    const timer = setInterval(() => {
      // TLDraw 展开 Minimap 时会在 DOM 中挂载特定的 class
      const hasMinimap =
        !!document.querySelector(".tlui-minimap") ||
        !!document.querySelector(".tl-minimap");
      setIsTagExpanded(hasMinimap);
    }, 200);

    return () => clearInterval(timer);
  }, [isEditMode]);

  const whiteboardRef = useRef<WhiteboardRef>(null);
  const { speak } = useTTS();

  // Buffer and lock for sequential processing
  const messageQueue = useRef<string[]>([]);
  const isProcessing = useRef<boolean>(false);
  const executionErrorsRef = useRef<string[]>([]);
  const sendRequestRef = useRef<
    ((text: string, canvasState: CanvasElement[], error?: string, base64Image?: string) => boolean) | null
  >(null);

  const processNextMessage = async () => {
    if (isProcessing.current || messageQueue.current.length === 0) {
      return;
    }
    isProcessing.current = true;

    // Combine all buffered messages into a single prompt context instead of taking just one
    const nextText = messageQueue.current.join("，然后");
    messageQueue.current = []; // Clear the buffer

    const canvasSnapshot =
      whiteboardRef.current?.getCanvasStateSnapshot() || [];
    let base64Image: string | undefined;
    if (whiteboardRef.current?.exportSnapshotAsBase64) {
      base64Image = await whiteboardRef.current.exportSnapshotAsBase64();
    }

    const success = sendRequestRef.current?.(
      nextText,
      canvasSnapshot,
      undefined,
      base64Image,
    );
    if (success) {
      setStatusText("🧠 凝音成形...");
    } else {
      setStatusText("重连中，请求已缓存...");
      messageQueue.current.unshift(nextText);
      isProcessing.current = false;
    }
  };

  useEffect(() => {
    if (wsStatus === "connected" && messageQueue.current.length > 0) {
      processNextMessage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus]);

  const handleServerMessage = async (response: ServerResponse) => {
    // Intercept agent's internal request for canvas state observation
    if (response.raw_text === "__request_observation__") {
      const canvasSnapshot =
        whiteboardRef.current?.getCanvasStateSnapshot() || [];
      const errorMsg =
        executionErrorsRef.current.length > 0
          ? executionErrorsRef.current.join("; ")
          : undefined;
          
      if (errorMsg) {
        message.warning({
          content: "捕捉到格式异常，系统已启动自动修复",
          key: "self-healing-toast", // Prevent duplicate toasts
          duration: 3,
        });
      }
      
      sendRequest("__observation__", canvasSnapshot, errorMsg);
      executionErrorsRef.current = []; // Clear after sending
      return;
    }

    // Agent interaction is completely done
    if (response.raw_text === "__done__") {
      isProcessing.current = false;
      setStatusText("✨ 跃然纸上");
      setTimeout(() => setStatusText("静候回声"), 2000);
      processNextMessage();
      return;
    }

    if (response.feedback) {
      setStatusText("需要补充信息");
      speak(response.feedback);
    }

    if (response.voice_reply) {
      speak(response.voice_reply);
    }

    if (response.actions || response.feedback || response.voice_reply) {
      if (response.actions && response.actions.length > 0) {
        const result = await whiteboardRef.current?.executeActions(response.actions);
        const errors = result || [];
        if (errors.length > 0) {
          executionErrorsRef.current.push(...errors);
        }
      }

      const newLog: DebugLog = {
        timestamp: new Date().toLocaleTimeString(),
        rawText: response.raw_text || "手动输入",
        taskAnalysis: response.task_analysis,
        plan: response.step_by_step_plan,
        actions: response.actions || [],
        feedback: response.feedback,
        voiceReply: response.voice_reply,
      };
      addDebugLog(newLog);
    }
  };

  const { sendRequest } = useWebSocket({
    onMessage: handleServerMessage,
  });
  
  useEffect(() => {
    sendRequestRef.current = sendRequest;
  }, [sendRequest]);

  const handleVoiceResult = (text: string) => {
    setTranscript(`语音输入: "${text}"`);
    triggerSend(text);
  };

  const {
    isRecording,
    isSupported: isSpeechSupported,
    startRecording,
    stopRecording,
  } = useSpeechRecognition({
    onResult: handleVoiceResult,
  });

  const triggerSend = (text: string) => {
    messageQueue.current.push(text);
    processNextMessage();
  };

  const handleManualSubmit = (text: string) => {
    setTranscript(`文字输入: "${text}"`);
    triggerSend(text);
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#3182ed", // TLDraw Blue
          borderRadius: 8,
          colorBgContainer: "#ffffff",
          colorBorder: "rgba(0, 0, 0, 0.06)",
        },
      }}
    >
      <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-row">
        {/* Left Control Panel Sider (using Curtain Effect for anti-jitter) */}
        <div
          style={{
            width: leftPanelVisible ? "380px" : "0px",
            borderRightWidth: leftPanelVisible ? "1px" : "0px",
            transition: "all 0.3s cubic-bezier(0.2, 0, 0, 1)",
          }}
          className="h-full bg-white border-slate-200 overflow-hidden flex flex-col shrink-0"
        >
          <div
            style={{ width: "380px" }}
            className="h-full p-6 overflow-y-auto shrink-0 box-border"
          >
            <ErrorBoundary>
              <ControlPanel
                isRecording={isRecording}
                isSpeechSupported={isSpeechSupported}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onSubmitManual={handleManualSubmit}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Center Canvas content */}
        <div className="relative h-full grow w-0 min-w-0 bg-white">
          {/* Floating panel-unfold triggers */}
          {!leftPanelVisible && (
            <div
              className="absolute left-4 z-50 transition-all duration-300 ease-in-out"
              style={{ top: isEditMode ? "56px" : "16px" }}
            >
              <Tooltip title="展开控制面板" placement="right">
                <Button
                  type="primary"
                  shape="circle"
                  size="large"
                  icon={<SettingOutlined />}
                  onClick={() => setLeftPanelVisible(true)}
                  className="shadow-md bg-slate-800 border-slate-800 hover:bg-slate-700 text-white"
                />
              </Tooltip>
            </div>
          )}

          {/* Floating Voice Input Button (visible when left panel is collapsed) */}
          {!leftPanelVisible && (
            <div
              className="absolute z-50 transition-all duration-300 ease-in-out flex flex-col items-center"
              style={{
                left: "16px",
                bottom: isEditMode
                  ? isTagExpanded
                    ? BOTTOM_EDIT_EXPANDED
                    : BOTTOM_EDIT_COLLAPSED
                  : BOTTOM_IDLE,
              }}
            >
              <Tooltip
                title={isRecording ? "点击结束录音" : "点击开始语音输入"}
                placement="top"
              >
                <div className="relative flex items-center justify-center w-16 h-16">
                  <Button
                    type="primary"
                    shape="circle"
                    icon={
                      <AudioOutlined
                        style={{ fontSize: 24 }}
                        className={isRecording ? "animate-pulse" : ""}
                      />
                    }
                    onClick={() =>
                      isRecording ? stopRecording() : startRecording()
                    }
                    style={{
                      width: 64,
                      height: 64,
                    }}
                    className={`z-10 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 border-none! ${
                      isRecording
                        ? "bg-rose-500! shadow-md shadow-rose-500/30"
                        : "bg-[#3182ed]! shadow-md hover:shadow-lg shadow-[#3182ed]/20"
                    }`}
                  />
                </div>
              </Tooltip>
              <div
                className={`absolute left-full ml-4 top-1/2 -translate-y-1/2 whitespace-nowrap text-rose-500 font-bold text-[13px] bg-white/95 px-3 py-1.5 rounded-lg shadow-md backdrop-blur-sm border border-rose-100 transition-all duration-300 ${isRecording ? "opacity-100 translate-x-0 animate-pulse" : "opacity-0 -translate-x-2 pointer-events-none"}`}
              >
                侧耳倾听...
              </div>
            </div>
          )}

          <div
            className="absolute top-4 z-50 flex items-center gap-3 transition-all duration-300 ease-in-out"
            style={{ right: isEditMode ? "174px" : "16px" }}
          >
            {/* System Status Indicator */}
            {!leftPanelVisible && (
              <Tooltip title={wsStatus === "connected" ? "系统已连接" : "系统已断开"} placement="bottom">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm cursor-help hover:bg-slate-50 transition-colors">
                  <div className={`w-2.5 h-2.5 rounded-full ${wsStatus === "connected" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"}`} />
                </div>
              </Tooltip>
            )}

            <Tooltip
              title={isEditMode ? "退出手动编辑" : "开启白板工具栏"}
              placement="bottomRight"
            >
              <Button
                type={isEditMode ? "primary" : "default"}
                shape="round"
                size="large"
                icon={<EditOutlined />}
                onClick={() => {
                  const nextMode = !isEditMode;
                  setIsEditMode(nextMode);
                  if (nextMode) {
                    setRightPanelVisible(false);
                  }
                }}
                className={
                  isEditMode
                    ? "shadow-md bg-[#3182ed] border-[#3182ed] hover:bg-[#53a0fa] text-white"
                    : "shadow-md bg-white border-slate-200 text-slate-600 hover:text-[#3182ed]"
                }
              >
                {isEditMode ? "编辑中" : "编辑"}
              </Button>
            </Tooltip>
            {!rightPanelVisible && (
              <Tooltip title="展开日志面板" placement="left">
                <Button
                  type="primary"
                  shape="circle"
                  size="large"
                  icon={<HistoryOutlined />}
                  onClick={() => setRightPanelVisible(true)}
                  className="shadow-md bg-slate-800 border-slate-800 hover:bg-slate-700 text-white"
                />
              </Tooltip>
            )}
          </div>

          <ErrorBoundary>
            <Whiteboard ref={whiteboardRef} hideUi={!isEditMode} />
          </ErrorBoundary>
        </div>

        {/* Right Debug Panel Sider (using Curtain Effect for anti-jitter) */}
        <div
          style={{
            width: rightPanelVisible ? "380px" : "0px",
            borderLeftWidth: rightPanelVisible ? "1px" : "0px",
            transition: "all 0.3s cubic-bezier(0.2, 0, 0, 1)",
          }}
          className="h-full bg-white border-slate-200 overflow-hidden flex flex-col shrink-0"
        >
          <div
            style={{ width: "380px" }}
            className="h-full p-6 overflow-y-auto shrink-0 box-border"
          >
            <ErrorBoundary>
              <DebugLogs />
            </ErrorBoundary>
          </div>
        </div>
      </div>

        <HelpPanel />
    </ConfigProvider>
  );
}
