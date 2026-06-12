import { useRef } from "react";
import { Button, ConfigProvider, theme, Tooltip } from "antd";
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
import type { DebugLog, ServerResponse } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import { ErrorBoundary } from "./ErrorBoundary";

export default function AppLayout() {
  const setStatusText = useAppStore((state) => state.setStatusText);
  const setTranscript = useAppStore((state) => state.setTranscript);
  const addDebugLog = useAppStore((state) => state.addDebugLog);
  
  const leftPanelVisible = useAppStore((state) => state.leftPanelVisible);
  const setLeftPanelVisible = useAppStore((state) => state.setLeftPanelVisible);
  const rightPanelVisible = useAppStore((state) => state.rightPanelVisible);
  const setRightPanelVisible = useAppStore((state) => state.setRightPanelVisible);
  const isEditMode = useAppStore((state) => state.isEditMode);
  const setIsEditMode = useAppStore((state) => state.setIsEditMode);

  const whiteboardRef = useRef<WhiteboardRef>(null);
  const { speak } = useTTS();

  // Buffer and lock for sequential processing
  const messageQueue = useRef<string[]>([]);
  const isProcessing = useRef<boolean>(false);
  const executionErrorsRef = useRef<string[]>([]);

  const processNextMessage = async () => {
    if (isProcessing.current || messageQueue.current.length === 0) {
      return;
    }
    isProcessing.current = true;
    
    // Combine all buffered messages into a single prompt context instead of taking just one
    const nextText = messageQueue.current.join("，然后");
    messageQueue.current = []; // Clear the buffer

    const canvasSnapshot = whiteboardRef.current?.getCanvasStateSnapshot() || [];
    let base64Image: string | undefined;
    if (whiteboardRef.current?.exportSnapshotAsBase64) {
      base64Image = await whiteboardRef.current.exportSnapshotAsBase64();
    }

    const success = sendRequest(nextText, canvasSnapshot, undefined, base64Image);
    if (success) {
      setStatusText("🧠 AI 思考中...");
    } else {
      setStatusText("服务器断开连接");
      isProcessing.current = false;
    }
  };

  const handleServerMessage = (response: ServerResponse) => {
    // Intercept agent's internal request for canvas state observation
    if (response.raw_text === "__request_observation__") {
      const canvasSnapshot = whiteboardRef.current?.getCanvasStateSnapshot() || [];
      const errorMsg = executionErrorsRef.current.length > 0 ? executionErrorsRef.current.join("; ") : undefined;
      sendRequest("__observation__", canvasSnapshot, errorMsg);
      executionErrorsRef.current = []; // Clear after sending
      return;
    }

    // Agent interaction is completely done
    if (response.raw_text === "__done__") {
      isProcessing.current = false;
      setStatusText("AI 执行完毕");
      setTimeout(() => setStatusText("等待指令"), 2000);
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
        const errors = whiteboardRef.current?.executeActions(response.actions) || [];
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

  const handleVoiceResult = (text: string) => {
    setTranscript(`语音输入: "${text}"`);
    triggerSend(text);
  };

  const handleSpeechStateChange = (recording: boolean) => {
    if (recording) {
      setStatusText("正在聆听...");
    }
  };

  const {
    isRecording,
    isSupported: isSpeechSupported,
    startRecording,
    stopRecording,
  } = useSpeechRecognition({
    onResult: handleVoiceResult,
    onListeningStateChange: handleSpeechStateChange,
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
            <ControlPanel
              isRecording={isRecording}
              isSpeechSupported={isSpeechSupported}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onSubmitManual={handleManualSubmit}
            />
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
              style={{ left: '24px', bottom: isEditMode ? '80px' : '24px' }}
            >
              <Tooltip title={isRecording ? "点击结束录音" : "点击开始语音输入"} placement="right">
                <div className="relative flex items-center justify-center w-16 h-16">
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<AudioOutlined style={{ fontSize: 24 }} />}
                    onClick={() => isRecording ? stopRecording() : startRecording()}
                    style={{
                      width: 64,
                      height: 64,
                      border: 'none',
                      transition: 'box-shadow 0.3s ease, transform 0.1s ease',
                      background: isRecording
                        ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
                        : 'linear-gradient(135deg, #53a0fa 0%, #3182ed 100%)',
                      boxShadow: isRecording
                        ? '0 8px 30px rgba(244, 63, 94, 0.4)'
                        : '0 8px 30px rgba(49, 130, 237, 0.3)',
                    }}
                    className={`z-10 hover:scale-105 active:scale-95 transition-transform ${isRecording ? 'recording' : ''}`}
                  />
                  {isRecording && <div className="pulse-ring-outer bg-rose-500/15!" style={{ animation: 'pulse-ring-anim 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite' }} />}
                </div>
              </Tooltip>
              <div 
                className={`absolute top-full mt-2 whitespace-nowrap text-rose-500 font-bold text-xs bg-white/90 px-2 py-1 rounded-md shadow-sm backdrop-blur-sm border border-rose-100 transition-all duration-300 ${isRecording ? 'opacity-100 translate-y-0 animate-pulse' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
              >
                正在聆听...
              </div>
            </div>
          )}

          <div
            className="absolute top-4 z-50 flex gap-3 transition-all duration-300 ease-in-out"
            style={{ right: isEditMode ? "174px" : "16px" }}
          >
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
            <DebugLogs />
          </div>
        </div>
      </div>

      <HelpPanel />
    </ConfigProvider>
  );
}
