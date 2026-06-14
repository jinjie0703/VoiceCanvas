import React, { useState } from "react";
import styles from "./ControlPanel.module.css";
import {
  Badge,
  Button,
  Form,
  Input,
  Space,
  Typography,
  message,
  Tooltip,
} from "antd";
import {
  AudioOutlined,
  SendOutlined,
  InfoCircleOutlined,
  MenuFoldOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import { useAppStore } from "../../store/useAppStore";
import { generateTextStream } from "../../api/ai";
import { AudioVisualizer } from "./AudioVisualizer";

const { Title, Text } = Typography;

interface ControlPanelProps {
  isRecording: boolean;
  isSpeechSupported: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSubmitManual: (text: string) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRecording,
  isSpeechSupported,
  onStartRecording,
  onStopRecording,
  onSubmitManual,
}) => {
  const wsStatus = useAppStore((state) => state.wsStatus);
  const statusText = useAppStore((state) => state.statusText);
  const transcript = useAppStore((state) => state.transcript);
  const onHidePanel = () => useAppStore.getState().setLeftPanelVisible(false);
  const manualText = useAppStore((state) => state.inputBoxText);
  const setManualText = useAppStore((state) => state.setInputBoxText);
  const dictationTarget = useAppStore((state) => state.dictationTarget);
  const setDictationTarget = useAppStore((state) => state.setDictationTarget);
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizingBgText, setOptimizingBgText] = useState("");

  const isDictating = isRecording && dictationTarget === "input";
  const isDictationSupported = isSpeechSupported;

  const startDictation = () => {
    setDictationTarget("input");
    onStartRecording();
  };

  const stopDictation = () => {
    setDictationTarget("ai");
    onStopRecording();
  };

  const handleOptimize = () => {
    if (!manualText.trim()) {
      message.info("请先输入一些简短的描述，AI 将为您扩充");
      return;
    }
    setIsOptimizing(true);
    const originalText = manualText.trim();
    setOptimizingBgText(originalText);
    setManualText("");

    generateTextStream(
      { theme: originalText },
      {
        onMessage: (data) => {
          setManualText((prev) => prev + data.text);
        },
        onClose: () => {
          setIsOptimizing(false);
          setOptimizingBgText("");
          message.success("提示词已优化！");
        },
        onError: () => {
          setIsOptimizing(false);
          setOptimizingBgText("");
          message.error("优化失败，请稍后重试");
        },
      },
    );
  };

  const handleSubmit = () => {
    if (!manualText.trim()) return;
    onSubmitManual(manualText);
    setManualText("");
  };

  const sampleCommands = [
    "绘制一个基于微服务的电商后端架构图",
    "创建一个带有用户鉴权流程的系统时序图",
    "一键清除并重置当前画布",
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
        <Space>
          <Button
            type="text"
            icon={<MenuFoldOutlined />}
            onClick={onHidePanel}
            title="收起面板"
            className="text-slate-600 hover:text-slate-800"
          />
          <Title
            level={4}
            style={{ margin: 0 }}
            className="font-bold tracking-tight"
          >
            <span className="bg-clip-text text-transparent! bg-linear-to-r from-sky-400 via-blue-500 to-indigo-500">
              VoiceCanvas AI
            </span>
          </Title>
        </Space>
        <Badge
          status={wsStatus === "connected" ? "success" : "error"}
          text={
            <Text
              className={`${wsStatus === "connected" ? "text-emerald-600" : "text-rose-500"} text-xs font-semibold`}
            >
              {wsStatus === "connected" ? "已就绪" : "未连接"}
            </Text>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto mt-4 pr-1.5 flex flex-col justify-between">
        <div>
          <div className="text-center mb-5 mt-2">
            <div className="text-slate-600 text-[13px] font-medium tracking-widest">
              「 循声而往，化意为形 」
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 my-2 p-5 bg-linear-to-b from-slate-50/80 to-slate-100/40 backdrop-blur-sm rounded-2xl border border-white/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden">
            <div
              className={`${styles["mic-button-container"]} ${isRecording && dictationTarget === "ai" ? styles.recording : ""} z-10`}
            >
              <div className={styles["vc-ripple-ring"]} />
              <div className={styles["vc-ripple-ring-1"]} />
              <div className={styles["vc-ripple-ring-2"]} />
              <Button
                type="primary"
                shape="circle"
                  icon={
                    <AudioOutlined
                      style={{ fontSize: 24 }}
                      className={isRecording && dictationTarget === "ai" ? "animate-pulse" : ""}
                    />
                  }
                  disabled={!isSpeechSupported}
                  onClick={() => {
                    if (isRecording && dictationTarget === "ai") {
                      onStopRecording();
                    } else {
                      setDictationTarget("ai");
                      onStartRecording();
                    }
                  }}
                  style={{
                    width: 64,
                    height: 64,
                  }}
                  className={`z-10 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 border-none! ${
                    isRecording && dictationTarget === "ai"
                      ? "bg-rose-500! shadow-md shadow-rose-500/30"
                      : "bg-[#3182ed]! shadow-md hover:shadow-lg shadow-[#3182ed]/20"
                  }`}
              />
            </div>

            <AudioVisualizer
              isActive={isRecording}
              isThinking={statusText.includes("🧠")}
            />

            <div className="w-full text-center z-10">
              <Text
                strong
                className={`block text-[11px] uppercase tracking-widest mb-2 ${
                  isRecording && dictationTarget === "ai"
                    ? "text-rose-500"
                    : statusText.includes("🧠")
                      ? "text-emerald-500 font-bold"
                      : "text-slate-400"
                }`}
              >
                {isRecording && dictationTarget === "ai" ? "侧耳倾听..." : statusText}
              </Text>

              <div className="bg-white/80 border border-slate-200 rounded-lg py-1.5 px-3 shadow-sm min-h-8 flex items-center justify-center">
                <Text className="text-slate-600 text-[13px] font-medium line-clamp-2">
                  {transcript || "✨ 倾听思考的形状..."}
                </Text>
              </div>
            </div>
          </div>
        </div>

        <div>
          {/* Sample Commands Quick Click */}
          <div className="mb-4 mt-2">
            <div className="flex items-center mb-3">
              <Text className="text-xs text-slate-500 font-medium">
                <InfoCircleOutlined className="mr-1 text-slate-400" />{" "}
                灵感以待：
              </Text>
              <div className="flex-1 h-px bg-slate-100 ml-2"></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {sampleCommands.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => onSubmitManual(cmd)}
                  className="text-left text-sky-600 bg-sky-50/60 hover:bg-sky-100 border border-sky-100 rounded-full py-1.5 px-3 text-[11px] font-medium transition-colors duration-200 cursor-pointer max-w-full truncate"
                  title={cmd}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          <Form onFinish={handleSubmit} className="w-full">
            <Form.Item className="mb-0">
              {/* 模拟一个完整的输入框外观，让操作按钮在视觉上“内含” */}
              <div className={`relative flex flex-col rounded-xl border transition-all bg-white overflow-hidden ${
                isDictating 
                  ? "border-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.15)] bg-emerald-50/10" 
                  : "border-gray-200 hover:border-blue-400 focus-within:border-blue-400 focus-within:shadow-[0_0_0_2px_rgba(5,145,255,0.1)]"
              }`}>
                {optimizingBgText && (
                  <div className="absolute top-0 left-0 w-full p-3 pb-1 text-sm text-gray-300 whitespace-pre-wrap pointer-events-none select-none z-0">
                    {optimizingBgText}
                  </div>
                )}
                <Input.TextArea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder={
                    optimizingBgText
                      ? ""
                      : isDictating
                        ? "🎙️ 正在聆听您的声音，将自动转为文字..."
                        : "描述你的构想，剩下的交给画布..."
                  }
                  autoSize={{ minRows: 3, maxRows: 5 }}
                  variant="borderless"
                  className="p-3 pb-1 text-sm resize-none focus:ring-0 shadow-none bg-transparent relative z-10"
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
                <div className="flex items-center justify-between px-2 pb-2 mt-1">
                  <div className="flex flex-col text-[10px] text-gray-400 pl-1 leading-tight justify-center gap-0.5">
                    <span>Enter 发送</span>
                    <span>Shift + Enter 换行</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="text"
                      size="small"
                      icon={<ThunderboltOutlined className="text-[#3182ed]" />}
                      loading={isOptimizing}
                      onClick={handleOptimize}
                      className="flex items-center text-xs text-[#3182ed] hover:bg-blue-50 rounded-lg px-2 h-7"
                    >
                      AI 优化
                    </Button>
                    {isDictationSupported && (
                      <Tooltip
                        title={
                          isDictating ? "停止语音输入" : "语音输入到文本框"
                        }
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={
                            <AudioOutlined
                              className={
                                isDictating
                                  ? "text-rose-500 animate-pulse"
                                  : "text-slate-500"
                              }
                            />
                          }
                          onClick={() =>
                            isDictating ? stopDictation() : startDictation()
                          }
                          className={`flex items-center justify-center rounded-lg h-7 px-2 transition-all ${isDictating ? "bg-rose-50 hover:bg-rose-100 shadow-inner" : "hover:bg-slate-100"}`}
                        />
                      </Tooltip>
                    )}
                    <Button
                      type="primary"
                      size="small"
                      icon={<SendOutlined style={{ fontSize: 12 }} />}
                      onClick={handleSubmit}
                      className="bg-[#3182ed] border-[#3182ed] hover:bg-[#53a0fa] shadow-sm flex items-center justify-center rounded-lg h-7 px-3"
                    >
                      <span className="text-xs">发送</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
};
