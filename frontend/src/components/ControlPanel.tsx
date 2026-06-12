import React, { useState } from 'react';
import { Badge, Button, Card, Divider, Form, Input, Space, Tooltip, Typography } from 'antd';
import { AudioOutlined, SendOutlined, InfoCircleOutlined, MenuFoldOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface ControlPanelProps {
  wsStatus: 'connected' | 'disconnected';
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
  const [manualText, setManualText] = useState('');

  const handleSubmit = () => {
    if (!manualText.trim()) return;
    onSubmitManual(manualText);
    setManualText('');
  };

  const sampleCommands = [
    '画一个蓝色的矩形',
    '在右上角创建一个黄色便签',
    '清除画布',
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
            <Title level={4} style={{ margin: 0 }} className="text-slate-800">VoiceCanvas AI</Title>
          </Space>
          <Badge
            status={wsStatus === 'connected' ? 'success' : 'error'}
            text={
              <Text className={`${wsStatus === 'connected' ? 'text-emerald-600' : 'text-rose-500'} text-xs font-semibold`}>
                {wsStatus === 'connected' ? '已连接' : '未连接'}
              </Text>
            }
          />
        </div>
        <Paragraph className="text-slate-500 text-xs leading-relaxed mb-6">
          语音智能手绘白板控制中心。按住下方麦克风并说话，或输入指令，AI 会自动为您绘制。
        </Paragraph>

        <div className="flex flex-col items-center gap-6 my-10">
          <div className={`mic-button-container ${isRecording ? 'recording' : ''}`}>
            <Button
              type="primary"
              shape="circle"
              icon={<AudioOutlined style={{ fontSize: 32 }} />}
              disabled={!isSpeechSupported}
              onMouseDown={onStartRecording}
              onMouseUp={onStopRecording}
              onTouchStart={onStartRecording}
              onTouchEnd={onStopRecording}
              className={`mic-button ${isRecording ? 'recording' : ''}`}
              style={{
                width: 90,
                height: 90,
                border: 'none',
                background: isRecording
                  ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
                  : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                boxShadow: isRecording
                  ? '0 8px 30px rgba(244, 63, 94, 0.3)'
                  : '0 8px 30px rgba(14, 165, 233, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <div className="pulse-ring-outer" />
          </div>

          <div className="w-full text-center">
            <Text
              strong
              className={`block text-sm uppercase tracking-wider mb-3 ${
                isRecording ? 'text-rose-500' : statusText.includes('🧠') ? 'text-emerald-500 font-bold' : 'text-slate-500'
              }`}
            >
              {isRecording ? '正在聆听中...' : statusText}
            </Text>
            
            <Card
              bordered
              className="bg-slate-50/50 border-slate-100 rounded-xl min-h-[70px] flex items-center justify-center"
              bodyStyle={{ padding: 12, width: '100%' }}
            >
              <Text className="text-slate-700 text-sm font-medium">
                {transcript}
              </Text>
            </Card>
          </div>

          <div className="voice-wave-container">
            <div className={`sound-wave ${isRecording ? 'active' : ''}`}>
              <span className="bg-slate-400" />
              <span className="bg-slate-400" />
              <span className="bg-slate-400" />
              <span className="bg-slate-400" />
              <span className="bg-slate-400" />
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
                size="small"
                type="text"
                onClick={() => onSubmitManual(cmd)}
                className="text-left text-sky-700 bg-sky-50/50 hover:bg-sky-100/50 border border-sky-100/50 rounded-md py-1 px-3 w-full text-xs truncate font-medium"
              >
                {cmd}
              </Button>
            ))}
          </div>
        </div>

        <Form onFinish={handleSubmit} className="w-full">
          <Form.Item className="mb-2">
            <Input
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="输入画图指令，如：画一个红色的便签..."
              suffix={
                <Tooltip title="发送指令">
                  <Button
                    type="primary"
                    shape="circle"
                    size="small"
                    icon={<SendOutlined style={{ fontSize: 12 }} />}
                    onClick={handleSubmit}
                    className="bg-sky-600 border-sky-600 hover:bg-sky-500"
                  />
                </Tooltip>
              }
              className="bg-white border-slate-200 text-slate-700 rounded-lg py-2 px-3 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </Form.Item>
        </Form>
        <div className="text-center">
          <Text className="text-[11px] text-slate-400">
            提示：按住录音按钮，或直接输入文字指令
          </Text>
        </div>
      </div>
    </div>
  );
};
