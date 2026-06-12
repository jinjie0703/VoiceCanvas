import React, { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Space,
  Tooltip,
  Typography,
} from "antd";
import {
  AudioOutlined,
  SendOutlined,
  InfoCircleOutlined,
  MenuFoldOutlined,
} from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;

interface ControlPanelProps {
  wsStatus: "connected" | "disconnected";
  isRecording: boolean;
  statusText: string;
  transcript: string;
  isSpeechSupported: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSubmitManual: (text: string) => void;
  onHidePanel: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  wsStatus,
  isRecording,
  statusText,
  transcript,
  isSpeechSupported,
  onStartRecording,
  onStopRecording,
  onSubmitManual,
  onHidePanel,
}) => {
  const [manualText, setManualText] = useState("");

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
          智能手绘辅助引擎。通过自然语言对话，AI 代理将为您实时生成与修改拓扑结构。
        </Paragraph>

        <div className="flex flex-col items-center gap-6 my-10">
          <div
            className={`mic-button-container ${isRecording ? "recording" : ""}`}
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
            <div className="pulse-ring-outer" />
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

          <div className="voice-wave-container">
            <div className={`sound-wave ${isRecording ? "active" : statusText.includes("思考") ? "thinking" : ""}`}>
              <span className="bg-slate-300" />
              <span className="bg-slate-300" />
              <span className="bg-slate-300" />
              <span className="bg-slate-300" />
              <span className="bg-slate-300" />
            </div>
          </div>
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
                className="text-left text-[#3182ed] bg-blue-50/50 hover:bg-blue-100/50 border border-blue-100/50 rounded-lg py-2 px-3 w-full text-xs font-medium h-auto whitespace-normal break-words leading-relaxed"
              >
                {cmd}
              </Button>
            ))}
          </div>
        </div>

        <Form onFinish={handleSubmit} className="w-full">
          <Form.Item className="mb-2">
            <div className="relative w-full">
              <Input.TextArea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="输入画图指令，例如：绘制一个前后端分离的系统架构图..."
                autoSize={{ minRows: 2, maxRows: 5 }}
                className="bg-white border-slate-200 text-slate-700 rounded-xl py-2 px-3 pr-10 focus:border-[#3182ed] focus:ring-1 focus:ring-[#3182ed] resize-none"
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <div className="absolute right-2 bottom-2 z-10">
                <Tooltip title="发送指令 (Enter发送，Shift+Enter换行)">
                  <Button
                    type="primary"
                    shape="circle"
                    size="small"
                    icon={<SendOutlined style={{ fontSize: 12 }} />}
                    onClick={handleSubmit}
                    className="bg-[#3182ed] border-[#3182ed] hover:bg-[#53a0fa] shadow-sm flex items-center justify-center"
                  />
                </Tooltip>
              </div>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};
