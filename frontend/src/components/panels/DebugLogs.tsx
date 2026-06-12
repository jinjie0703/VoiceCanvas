import React from 'react';
import { Button, Card, Empty, List, Typography } from 'antd';
import { DeleteOutlined, MenuUnfoldOutlined } from '@ant-design/icons';


import { useAppStore } from '../../store/useAppStore';

const { Title, Text } = Typography;

export const DebugLogs: React.FC = () => {
  const logs = useAppStore((state) => state.debugLogs);
  const onClear = useAppStore((state) => state.clearDebugLogs);
  const onHidePanel = () => useAppStore.getState().setRightPanelVisible(false);
  const renderJsonHighlight = (jsonObj: unknown) => {
    const jsonString = JSON.stringify(jsonObj, null, 2);
    const highlighted = jsonString.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?=\s*:))|("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")|(\b(true|false|null)\b)|(\b[0-9]+\b)/g,
      (match) => {
        let cls = 'debug-json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'debug-json-key';
          } else {
            cls = 'debug-json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'debug-json-boolean';
        } else if (/null/.test(match)) {
          cls = 'debug-json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
    return { __html: highlighted };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <Title level={5} style={{ margin: 0 }} className="text-slate-800 flex items-center gap-2">
          <span className="inline-block rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)] w-1.5 h-1.5" />
          Agent Action Logs
        </Title>
        <div className="flex gap-2">
          <Button
            size="small"
            type="text"
            icon={<DeleteOutlined />}
            onClick={onClear}
            className="text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-md"
          >
            清除
          </Button>
          <Button
            type="text"
            size="small"
            icon={<MenuUnfoldOutlined />}
            onClick={onHidePanel}
            title="收起面板"
            className="text-slate-600 hover:text-slate-800"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mt-4 pr-1.5">
        {logs.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Text className="text-slate-400 text-xs">
                  暂无智能体动作日志。<br />尝试在左侧下发绘图指令。
                </Text>
              }
            />
          </div>
        ) : (
          <List
            dataSource={logs}
            split={false}
            renderItem={(logItem) => (
              <List.Item style={{ display: 'block', padding: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', marginBottom: 16 }}>
                <div className="flex justify-between mb-1">
                  <Text className="text-[10px] text-slate-400 font-medium">{logItem.timestamp}</Text>
                </div>
                <div className="text-sky-600 font-semibold text-xs mb-2">
                  用户输入: {logItem.rawText}
                </div>
                {logItem.feedback && (
                  <div className="bg-orange-50 border border-orange-100 rounded-md p-2 mb-2">
                    <Text className="text-orange-600 font-semibold text-[11px] block mb-1">系统反馈:</Text>
                    <Text className="text-orange-500 text-[11px]">
                      {logItem.feedback}
                    </Text>
                  </div>
                )}
                {logItem.taskAnalysis && (
                  <div className="bg-slate-100 rounded-md p-2 mb-2">
                    <Text className="text-slate-600 text-[11px] italic">
                      " {logItem.taskAnalysis} "
                    </Text>
                  </div>
                )}
                {logItem.plan && logItem.plan.length > 0 && (
                  <div className="mb-2">
                    <Text className="text-slate-500 font-semibold text-[11px] mb-1 block">Agent 计划:</Text>
                    <ul className="pl-4 m-0 text-[11px] text-slate-600 list-disc">
                      {logItem.plan.map((step, idx) => (
                        <li key={idx} className="mb-0.5">{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Card
                  variant="outlined"
                  className="bg-slate-50/50 border-slate-100 rounded-xl"
                  styles={{ body: { padding: 12 } }}
                >
                  <pre
                    className="debug-json m-0 p-0 bg-transparent border-none text-[11px] max-h-50 overflow-y-auto"
                    dangerouslySetInnerHTML={renderJsonHighlight({ actions: logItem.actions })}
                  />
                </Card>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};
