import { useState, useRef } from 'react';
import { Button, ConfigProvider, theme, Tooltip } from 'antd';
import { SettingOutlined, HistoryOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { useWebSocket } from './hooks/useWebSocket';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { ControlPanel } from './components/ControlPanel';
import { DebugLogs } from './components/DebugLogs';
import { Whiteboard } from './components/Whiteboard';
import type { WhiteboardRef } from './components/Whiteboard';
import type { DebugLog, ServerResponse } from './types';

export default function App() {
  const [statusText, setStatusText] = useState('等待指令');
  const [transcript, setTranscript] = useState('尝试说些什么，例如：“在中心画一个红色圆圈”');
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);

  const whiteboardRef = useRef<WhiteboardRef>(null);

  const handleServerMessage = (response: ServerResponse) => {
    setStatusText('AI 执行成功');
    setTimeout(() => setStatusText('等待指令'), 2000);

    if (response.actions) {
      whiteboardRef.current?.executeActions(response.actions);
      
      const newLog: DebugLog = {
        timestamp: new Date().toLocaleTimeString(),
        rawText: response.raw_text || '手动输入',
        actions: response.actions,
      };
      setDebugLogs((prev) => [newLog, ...prev]);
    }
  };

  const { wsStatus, sendRequest } = useWebSocket({
    onMessage: handleServerMessage,
  });

  const handleVoiceResult = (text: string) => {
    setTranscript(`语音输入: "${text}"`);
    triggerSend(text);
  };

  const handleSpeechStateChange = (recording: boolean) => {
    if (recording) {
      setStatusText('正在聆听...');
    }
  };

  const { isRecording, isSupported: isSpeechSupported, startRecording, stopRecording } = useSpeechRecognition({
    onResult: handleVoiceResult,
    onListeningStateChange: handleSpeechStateChange,
  });

  const triggerSend = (text: string) => {
    const canvasSnapshot = whiteboardRef.current?.getCanvasStateSnapshot() || [];
    const success = sendRequest(text, canvasSnapshot);
    if (success) {
      setStatusText('🧠 AI 思考中...');
    } else {
      setStatusText('服务器断开连接');
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
          colorPrimary: '#0284c7', // Sky Blue
          borderRadius: 8,
          colorBgContainer: '#ffffff',
          colorBorder: 'rgba(0, 0, 0, 0.06)',
        },
      }}
    >
      <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-row">
        {/* Left Control Panel Sider (using standard div for robust width reflow) */}
        <div
          style={{
            width: leftPanelVisible ? '380px' : '0px',
            padding: leftPanelVisible ? '24px' : '0px',
            borderRightWidth: leftPanelVisible ? '1px' : '0px',
            transition: 'width 0.2s ease, padding 0.2s ease, border-width 0.2s ease',
          }}
          className="h-full bg-white border-slate-200 overflow-y-auto flex flex-col flex-shrink-0"
        >
          {leftPanelVisible && (
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
          )}
        </div>

        {/* Center Canvas content */}
        <div className="relative h-full flex-grow w-0 min-w-0 bg-white">
          {/* Floating panel-unfold triggers: Left trigger on top-left, Right trigger on top-right */}
          {!leftPanelVisible && (
            <div className="absolute top-4 left-4 z-50">
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
          {!rightPanelVisible && (
            <div className="absolute top-4 right-4 z-50">
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
            </div>
          )}

          <Whiteboard ref={whiteboardRef} />
        </div>

        {/* Right Debug Panel Sider (using standard div for robust width reflow) */}
        <div
          style={{
            width: rightPanelVisible ? '380px' : '0px',
            padding: rightPanelVisible ? '24px' : '0px',
            borderLeftWidth: rightPanelVisible ? '1px' : '0px',
            transition: 'width 0.2s ease, padding 0.2s ease, border-width 0.2s ease',
          }}
          className="h-full bg-white border-slate-200 overflow-y-auto flex flex-col flex-shrink-0"
        >
          {rightPanelVisible && (
            <DebugLogs
              logs={debugLogs}
              onClear={() => setDebugLogs([])}
              onHidePanel={() => setRightPanelVisible(false)}
            />
          )}
        </div>
      </div>
    </ConfigProvider>
  );
}
