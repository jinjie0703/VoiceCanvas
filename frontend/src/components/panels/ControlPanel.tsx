import React, { useState } from "react";
import styles from "./ControlPanel.module.css";
import {
  Badge,
  Button,
  Card,
  Divider,
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
import { useSpeechRecognition } from "../../services/speech/useSpeechRecognition";
import { AudioVisualizer } from "./AudioVisualizer";

const { Title, Paragraph, Text } = Typography;

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
  const [manualText, setManualText] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizingBgText, setOptimizingBgText] = useState("");

  const {
    isRecording: isDictating,
    isSupported: isDictationSupported,
    startRecording: startDictation,
    stopRecording: stopDictation,
  } = useSpeechRecognition({
    onResult: (text) => {
      setManualText((prev) => prev + text);
    },
  });

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
      }
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
    <div className="flex flex-col h-full justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <Space>
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={onHidePanel}
              title="收起面板"
              className="text-slate-600 hover:text-slate-800"
            />
            <Title level={4} style={{ margin: 0 }} className="text-slate-800">
              VoiceCanvas AI
            </Title>
          </Space>
          <Badge
            status={wsStatus === "connected" ? "success" : "error"}
            text={
              <Text
                className={`${wsStatus === "connected" ? "text-emerald-600" : "text-rose-500"} text-xs font-semibold`}
              >
                {wsStatus === "connected" ? "已连接" : "未连接"}
              </Text>
            }
          />
        </div>
        <Paragraph className="text-slate-500 text-xs leading-relaxed mb-6">
          智能手绘辅助引擎。通过自然语言对话，AI
          代理将为您实时生成与修改拓扑结构。
        </Paragraph>

        <div className="flex flex-col items-center gap-6 my-10">
          <div
            className={`${styles['mic-button-container']} ${isRecording ? styles.recording : ""}`}
          >
            <Button
              type="primary"
              shape="circle"
              icon={<AudioOutlined style={{ fontSize: 32 }} />}
              disabled={!isSpeechSupported}
              onClick={() =>
                isRecording ? onStopRecording() : onStartRecording()
              }
              className={`mic-button z-10 transition-transform duration-200 hover:scale-105 active:scale-95 ${isRecording ? "recording" : ""}`}
              style={{
                width: 90,
                height: 90,
                border: "none",
                transition: "box-shadow 0.3s ease",
                background: isRecording
                  ? "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)"
                  : "linear-gradient(135deg, #53a0fa 0%, #3182ed 100%)",
                boxShadow: isRecording
                  ? "0 8px 30px rgba(244, 63, 94, 0.4)"
                  : "0 8px 30px rgba(49, 130, 237, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            />
            <div className={styles['pulse-ring-outer']} />
          </div>

          <div className="w-full text-center">
            <Text
              strong
              className={`block text-sm uppercase tracking-wider mb-3 ${
                isRecording
                  ? "text-rose-500"
                  : statusText.includes("🧠")
                    ? "text-emerald-500 font-bold"
                    : "text-slate-500"
              }`}
            >
              {isRecording ? "正在聆听中..." : statusText}
            </Text>

            <Card
              variant="outlined"
              className="bg-slate-50/50 border-slate-100 rounded-xl min-h-17.5 flex items-center justify-center"
              styles={{ body: { padding: 12, width: "100%" } }}
            >
              <Text className="text-slate-700 text-sm font-medium">
                {transcript}
              </Text>
            </Card>
          </div>

          <AudioVisualizer 
            isActive={isRecording} 
            isThinking={statusText.includes("思考")} 
          />
        </div>
      </div>

      <div>
        <Divider className="border-slate-100 my-4" />

        {/* Sample Commands Quick Click */}
        <div className="mb-4">
          <Space className="block mb-2">
            <Text className="text-xs text-slate-500 font-medium">
              <InfoCircleOutlined className="mr-1 text-slate-400" /> 推荐尝试：
            </Text>
          </Space>
          <div className="flex flex-col gap-2">
            {sampleCommands.map((cmd) => (
              <Button
                key={cmd}
                type="text"
                onClick={() => onSubmitManual(cmd)}
                className="text-left text-[#3182ed] bg-blue-50/50 hover:bg-blue-100/50 border border-blue-100/50 rounded-lg py-2 px-3 w-full text-xs font-medium h-auto whitespace-normal wrap-break-word leading-relaxed"
              >
                {cmd}
              </Button>
            ))}
          </div>
        </div>

        <Form onFinish={handleSubmit} className="w-full">
          <Form.Item className="mb-0">
            {/* 模拟一个完整的输入框外观，让操作按钮在视觉上“内含” */}
            <div className="relative flex flex-col rounded-xl border border-gray-200 hover:border-blue-400 focus-within:border-blue-400 focus-within:shadow-[0_0_0_2px_rgba(5,145,255,0.1)] transition-all bg-white overflow-hidden">
              {optimizingBgText && (
                <div className="absolute top-0 left-0 w-full p-3 pb-1 text-sm text-gray-300 whitespace-pre-wrap pointer-events-none select-none z-0">
                  {optimizingBgText}
                </div>
              )}
              <Input.TextArea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={optimizingBgText ? "" : "输入画图指令，例如：绘制一个前后端分离的系统架构图..."}
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
                    <Tooltip title={isDictating ? "停止语音输入" : "语音输入到文本框"}>
                      <Button
                        type="text"
                        size="small"
                        icon={<AudioOutlined className={isDictating ? "text-rose-500 animate-pulse" : "text-slate-500"} />}
                        onClick={() => isDictating ? stopDictation() : startDictation()}
                        className={`flex items-center justify-center rounded-lg h-7 px-2 ${isDictating ? "bg-rose-50 hover:bg-rose-100" : "hover:bg-slate-100"}`}
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
  );
};
