import React, { useState, useRef, useEffect } from 'react';
import { Button, Typography } from 'antd';
import { BulbOutlined, CloseOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface HelpPanelProps {
  rightPanelVisible: boolean;
  isEditMode: boolean;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ rightPanelVisible, isEditMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Dynamic positioning to perfectly avoid overlapping with right log panel and tldraw bottom UI
  const rightPos = rightPanelVisible ? 420 : 24;
  const bottomPos = isEditMode ? 80 : 24;

  return (
    <div 
      ref={panelRef}
      className="absolute z-50 transition-all duration-300 ease-in-out flex flex-col items-end"
      style={{ right: `${rightPos}px`, bottom: `${bottomPos}px` }}
    >
      {/* Expanded Panel */}
      <div 
        className={`bg-white/85 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ease-out origin-bottom-right ${
          isOpen ? 'w-[340px] h-[480px] opacity-100 scale-100 mb-4' : 'w-0 h-0 opacity-0 scale-95 mb-0 pointer-events-none'
        }`}
      >
        {isOpen && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#3182ed]/10 flex items-center justify-center text-[#3182ed]">
                  <BulbOutlined style={{ fontSize: 16 }} />
                </div>
                <div>
                  <Title level={5} style={{ margin: 0 }} className="text-slate-800 tracking-tight">指令速查</Title>
                  <Text className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Prompt Guide</Text>
                </div>
              </div>
              <Button 
                type="text" 
                icon={<CloseOutlined />} 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100" 
              />
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="mb-6">
                <Text className="text-xs font-bold text-slate-400 mb-3 block uppercase tracking-wider">🏗️ 架构与内容生成</Text>
                <div className="space-y-3">
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 hover:border-[#3182ed]/30 transition-colors">
                    <Text className="text-sm font-semibold text-slate-700 block mb-1">生成系统架构图</Text>
                    <Text className="text-xs text-slate-500">"画一个包含网关、鉴权和数据库的微服务后端架构图"</Text>
                  </div>
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 hover:border-[#3182ed]/30 transition-colors">
                    <Text className="text-sm font-semibold text-slate-700 block mb-1">生成业务流程图</Text>
                    <Text className="text-xs text-slate-500">"创建一个用户扫码登录的流程图，用便签标注关键异常分支"</Text>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <Text className="text-xs font-bold text-slate-400 mb-3 block uppercase tracking-wider">🎨 样式与属性修改</Text>
                <div className="space-y-3">
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 hover:border-[#3182ed]/30 transition-colors">
                    <Text className="text-sm font-semibold text-slate-700 block mb-1">批量颜色修改</Text>
                    <Text className="text-xs text-slate-500">"把画板里所有红色的矩形变成蓝色"，"将刚才生成的便签改成黄色"</Text>
                  </div>
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 hover:border-[#3182ed]/30 transition-colors">
                    <Text className="text-sm font-semibold text-slate-700 block mb-1">空间布局对齐</Text>
                    <Text className="text-xs text-slate-500">"将这些图形从左到右水平对齐，间距保持一致"</Text>
                  </div>
                </div>
              </div>

              <div className="mb-2">
                <Text className="text-xs font-bold text-slate-400 mb-3 block uppercase tracking-wider">🔧 基础白板控制</Text>
                <div className="space-y-3">
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex justify-between items-center hover:border-[#3182ed]/30 transition-colors">
                    <Text className="text-sm font-semibold text-slate-700">清除所有内容</Text>
                    <Text className="text-[11px] text-[#3182ed] bg-blue-50 px-2 py-0.5 rounded font-mono font-medium border border-blue-100">"清空画布"</Text>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Toggle Button */}
      {!isOpen && (
        <Button
          type="primary"
          shape="round"
          size="large"
          icon={<BulbOutlined />}
          onClick={() => setIsOpen(true)}
          className="shadow-lg bg-slate-800 border-slate-800 hover:bg-slate-700 text-white flex items-center gap-1 transition-transform hover:scale-105 active:scale-95"
        >
          查看指令
        </Button>
      )}
    </div>
  );
};
