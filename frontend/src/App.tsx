import { useState, useRef } from "react";
import { Button, ConfigProvider, theme, Tooltip } from "antd";
import {
  SettingOutlined,
  HistoryOutlined,
  EditOutlined,
  AudioOutlined,
} from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { ControlPanel } from "./components/ControlPanel";
import { DebugLogs } from "./components/DebugLogs";
import { HelpPanel } from "./components/HelpPanel";
import { Whiteboard } from "./components/Whiteboard";
import type { WhiteboardRef } from "./components/Whiteboard";
import type { DebugLog, ServerResponse } from "./types";

export default function App() {
  const [statusText, setStatusText] = useState("等待指令");
  const [transcript, setTranscript] = useState(
    "尝试说些什么，例如：“在中心画一个红色圆圈”",
  );
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);

  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  const whiteboardRef = useRef<WhiteboardRef>(null);

  const handleServerMessage = (response: ServerResponse) => {
    if (response.feedback) {
      setStatusText("需要补充信息");
    } else {
      setStatusText("AI 执行成功");
    }
    setTimeout(() => setStatusText("等待指令"), 2000);

    if (response.actions || response.feedback) {
      if (response.actions && response.actions.length > 0) {
        whiteboardRef.current?.executeActions(response.actions);
      }

      const newLog: DebugLog = {
        timestamp: new Date().toLocaleTimeString(),
        rawText: response.raw_text || "手动输入",
        taskAnalysis: response.task_analysis,
        plan: response.step_by_step_plan,
        actions: response.actions || [],
        feedback: response.feedback,
      };
      setDebugLogs((prev) => [newLog, ...prev]);
    }
  };

  const { wsStatus, sendRequest } = useWebSocket({
    onMessage: handleServerMessage,
    getCanvasState: () => whiteboardRef.current?.getCanvasStateSnapshot() ?? [],
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
    const canvasSnapshot =
      whiteboardRef.current?.getCanvasStateSnapshot() || [];
    const success = sendRequest(text, canvasSnapshot);
    if (success) {
      setStatusText("🧠 AI 思考中...");
    } else {
      setStatusText("服务器断开连接");
    }
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
              wsStatus={wsStatus}
              isRecording={isRecording}
              statusText={statusText}
              transcript={transcript}
              isSpeechSupported={isSpeechSupported}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onSubmitManual={handleManualSubmit}
              onHidePanel={() => setLeftPanelVisible(false)}
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

          <Whiteboard ref={whiteboardRef} hideUi={!isEditMode} />
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
            <DebugLogs
              logs={debugLogs}
              onClear={() => setDebugLogs([])}
              onHidePanel={() => setRightPanelVisible(false)}
            />
          </div>
        </div>
      </div>

      <HelpPanel rightPanelVisible={rightPanelVisible} isEditMode={isEditMode} />
    </ConfigProvider>
  );
}
