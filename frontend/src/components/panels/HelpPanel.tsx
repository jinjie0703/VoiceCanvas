import React, { useState, useRef, useEffect } from "react";
import { Button, Typography, Badge } from "antd";
import { BulbOutlined, CloseOutlined } from "@ant-design/icons";

import { useAppStore } from "../../store/useAppStore";

const { Text, Title } = Typography;

export const HelpPanel: React.FC = () => {
  const rightPanelVisible = useAppStore((state) => state.rightPanelVisible);
  const isEditMode = useAppStore((state) => state.isEditMode);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
        className={`absolute bottom-14 right-0 w-96 max-h-[80vh] bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out origin-bottom-right ${
          isOpen
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#3182ed]/10 flex items-center justify-center text-[#3182ed]">
                <BulbOutlined style={{ fontSize: 16 }} />
              </div>
              <div>
                <Title
                  level={5}
                  style={{ margin: 0 }}
                  className="text-slate-800 tracking-tight"
                >
                  指令速查
                </Title>
                <Text className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                  Prompt Guide
                </Text>
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
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5 custom-scrollbar">
            {/* Category 1: Multimedia */}
            <div className="mb-6">
              <Text className="text-xs font-bold text-violet-500 mb-3 block uppercase tracking-wider">
                ✨ 智能多媒体生成
              </Text>
              <div className="space-y-3">
                <Badge.Ribbon
                  text="SVG"
                  color="purple"
                  placement="end"
                  style={{ top: -8, right: -8 }}
                >
                  <div className="bg-linear-to-r from-violet-50/80 to-purple-50/30 rounded-xl p-3 border border-violet-100 hover:border-violet-300 transition-colors w-full">
                    <Text className="text-sm font-semibold text-slate-700 block mb-1">
                      SVG 代码渲染
                    </Text>
                    <Text className="text-xs text-slate-500 block leading-relaxed wrap-break-word whitespace-normal">
                      "用 SVG 画一个 Github 的 Logo"
                      <br />
                      "在左上角渲染一个红色的爱心 SVG"
                    </Text>
                  </div>
                </Badge.Ribbon>

                <Badge.Ribbon
                  text="Wanx"
                  color="pink"
                  placement="end"
                  style={{ top: -8, right: -8 }}
                >
                  <div className="bg-linear-to-r from-pink-50/80 to-rose-50/30 rounded-xl p-3 border border-pink-100 hover:border-pink-300 transition-colors mt-2 w-full">
                    <Text className="text-sm font-semibold text-slate-700 block mb-1">
                      AI 绘图 / 寻图
                    </Text>
                    <Text className="text-xs text-slate-500 block leading-relaxed wrap-break-word whitespace-normal">
                      "生成一张赛博朋克未来城市的图片"
                      <br />
                      "找一张苹果的高清图片放到画布上"
                    </Text>
                  </div>
                </Badge.Ribbon>
              </div>
            </div>

            {/* Category 2: Alignment and Modification */}
            <div className="mb-6">
              <Text className="text-xs font-bold text-sky-500 mb-3 block uppercase tracking-wider">
                📐 空间排版与修改
              </Text>
              <div className="space-y-3">
                <div className="bg-sky-50/40 rounded-xl p-3 border border-sky-100 hover:border-sky-300 transition-colors w-full">
                  <Text className="text-sm font-semibold text-slate-700 block mb-1">
                    智能弯曲连线
                  </Text>
                  <Text className="text-xs text-slate-500 block leading-relaxed wrap-break-word whitespace-normal">
                    "把用户节点和网关用一条红色的虚线连起来，箭头要弯曲一点"
                  </Text>
                </div>
                <div className="bg-sky-50/40 rounded-xl p-3 border border-sky-100 hover:border-sky-300 transition-colors w-full">
                  <Text className="text-sm font-semibold text-slate-700 block mb-1">
                    一句话对齐与图层
                  </Text>
                  <Text className="text-xs text-slate-500 block leading-relaxed wrap-break-word whitespace-normal">
                    "把这三个节点水平居中对齐"
                    <br />
                    "把这个红色的背景框置于底层"
                  </Text>
                </div>
                <div className="bg-sky-50/40 rounded-xl p-3 border border-sky-100 hover:border-sky-300 transition-colors w-full">
                  <Text className="text-sm font-semibold text-slate-700 block mb-1">
                    批量颜色与样式
                  </Text>
                  <Text className="text-xs text-slate-500 block leading-relaxed wrap-break-word whitespace-normal">
                    "把画板里所有红色的矩形变成蓝色"
                  </Text>
                </div>
              </div>
            </div>

            {/* Category 3: Basic Architecture */}
            <div className="mb-6">
              <Text className="text-xs font-bold text-slate-400 mb-3 block uppercase tracking-wider">
                🏗️ 架构与画布控制
              </Text>
              <div className="space-y-3">
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 hover:border-slate-300 transition-colors w-full">
                  <Text className="text-sm font-semibold text-slate-700 block mb-1">
                    生成复杂架构
                  </Text>
                  <Text className="text-xs text-slate-500 block leading-relaxed wrap-break-word whitespace-normal">
                    "画一个包含网关、鉴权和数据库的微服务后端架构图"
                  </Text>
                </div>
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex justify-between items-center hover:border-slate-300 transition-colors w-full">
                  <Text className="text-sm font-semibold text-slate-700 shrink-0">
                    清除所有内容
                  </Text>
                  <Text className="text-[11px] text-rose-500 bg-rose-50 px-2 py-0.5 rounded font-mono font-medium border border-rose-100 wrap-break-word ml-2 text-right">
                    "清空画布"
                  </Text>
                </div>
              </div>
            </div>

            {/* Tips Section */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <Text className="text-[11px] text-amber-500 font-medium flex gap-1 wrap-break-word whitespace-normal leading-relaxed">
                💡 提示：对于复杂的多媒体生成任务，云端推理可能需要 5-15
                秒，请耐心等待画布加载。
              </Text>
            </div>
        </div>
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
