import { useState, useEffect, useRef, useCallback } from "react";

interface UseSpeechRecognitionProps {
  onResult: (text: string) => void;
  onListeningStateChange?: (isRecording: boolean) => void;
  wakeWordRegex?: RegExp;
  sleepWordRegex?: RegExp;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: unknown) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: { new (): ISpeechRecognition };
  webkitSpeechRecognition?: { new (): ISpeechRecognition };
}

/**
 * 恢复并优化后的语音唤醒与常驻监听 Hook。
 *
 * 核心逻辑：
 * 1. 物理麦克风在后台始终保持开启（常驻监听），除非组件卸载。
 * 2. 物理麦克风中断时（onend），会自动重新启动。
 * 3. 两种唤醒/开启方式：
 *    - 语音唤醒：在休眠状态下说出唤醒词（如 "Hi Canvas"），激活唤醒状态。
 *    - 手动点击：点击界面按钮，直接激活唤醒状态（无需唤醒词）。
 * 4. 激活状态下，接收的所有语音片段都会通过 onResult 回传；说出休眠词（如 "休息"）或再次点击按钮将回到休眠状态（继续在后台监听唤醒词）。
 */
export function useSpeechRecognition({
  onResult,
  onListeningStateChange,
  wakeWordRegex = /(hi|hey|hello|嗨|hai|海|哈喽|你好)[\s,，]*(canvas|画板|画布)(.*)/i,
  sleepWordRegex = /(关闭|退出|休息)[\s,，]*(canvas|画板|画布)?/i,
}: UseSpeechRecognitionProps) {
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const win = window as unknown as WindowWithSpeech;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  });

  const [isAwake, setIsAwake] = useState(false);
  const isAwakeRef = useRef(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const onResultRef = useRef(onResult);
  const onListeningStateChangeRef = useRef(onListeningStateChange);
  const wakeWordRegexRef = useRef(wakeWordRegex);
  const sleepWordRegexRef = useRef(sleepWordRegex);

  // 标记是否被 TTS 播报期间静音独占
  const isMutedByTTSRef = useRef(false);

  useEffect(() => {
    onResultRef.current = onResult;
    onListeningStateChangeRef.current = onListeningStateChange;
    wakeWordRegexRef.current = wakeWordRegex;
    sleepWordRegexRef.current = sleepWordRegex;
  });

  useEffect(() => {
    isAwakeRef.current = isAwake;
    onListeningStateChangeRef.current?.(isAwake);
    console.log(
      `[Speech] 唤醒状态改变为: ${isAwake ? "已唤醒 (Awake)" : "已休眠 (Asleep)"}`,
    );
  }, [isAwake]);

  useEffect(() => {
    let isUnmounted = false;
    const win = window as unknown as WindowWithSpeech;
    const SpeechRecognitionCtor =
      win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      console.warn("[Speech] 浏览器不支持 Web Speech API");
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "zh-CN";

    rec.onstart = () => {
      console.log("[Speech] 物理麦克风开启，正在监听语音...");
    };

    let lastRestart = 0;

    const startMic = () => {
      if (isUnmounted) return;
      if (isMutedByTTSRef.current) {
        console.log("[Speech] TTS 播放中，暂不真正启动麦克风。");
        return;
      }
      try {
        lastRestart = Date.now();
        rec.start();
        console.log("[Speech] 物理麦克风启动/重启成功");
      } catch (err) {
        console.warn(
          "[Speech] 启动麦克风同步失败，可能已处于运行状态或被占用。将在 1000ms 后重试:",
          err,
        );
        // 如果同步启动失败（比如被系统占用或正在关闭），1秒后重试
        setTimeout(startMic, 1000);
      }
    };

    rec.onend = () => {
      console.log("[Speech] 物理麦克风已断开");
      // 如果不是组件卸载且没有被 TTS 静音挂起，就自动重启以保持常驻监听
      if (!isUnmounted) {
        if (isMutedByTTSRef.current) {
          console.log(
            "[Speech] 麦克风因 TTS 独占处于静音挂起状态，等待播放结束重新唤醒。",
          );
          return;
        }
        const now = Date.now();
        const timeSinceLastRestart = now - lastRestart;
        const delay = timeSinceLastRestart < 1000 ? 1000 : 10;

        console.log(`[Speech] 将在 ${delay}ms 后尝试重启物理麦克风`);
        setTimeout(startMic, delay);
      }
    };

    rec.onerror = (e: unknown) => {
      const err = e as { error?: string };
      console.error("[Speech] 语音识别报错:", err.error || err);
      if (err.error === "not-allowed") {
        setIsAwake(false);
      }
    };

    rec.onresult = (event: unknown) => {
      const speechEvent = event as {
        resultIndex: number;
        results: {
          isFinal: boolean;
          [key: number]: { transcript: string };
        }[];
      };
      const results = speechEvent.results;
      if (!results || results.length === 0) return;

      for (let i = speechEvent.resultIndex; i < results.length; i++) {
        const result = results[i];
        if (!result.isFinal) continue;

        const text = result[0].transcript.trim();
        if (!text) continue;

        console.log(`[Speech] 听到语音片段: "${text}"`);

        if (!isAwakeRef.current) {
          // 未唤醒状态：匹配唤醒词
          const match = text.match(wakeWordRegexRef.current);
          if (match) {
            console.log(`[Speech] 匹配到唤醒词! 识别文本: "${match[0]}"`);
            setIsAwake(true);

            // 过滤掉指令前后的标点符号（如句号、逗号、问号等），防止将纯标点当作指令发送给后端
            const remainingText = match[3]?.trim() || "";
            const cleanRemaining = remainingText
              .replace(/^[.,，。?？!\s]+|[.,，。?？!\s]+$/g, "")
              .trim();

            if (cleanRemaining) {
              console.log(`[Speech] 唤醒并携带指令: "${cleanRemaining}"`);
              onResultRef.current(cleanRemaining);
            } else {
              console.log(`[Speech] 仅唤醒，无携带有效指令。`);
            }
          } else {
            console.log(`[Speech] 未唤醒状态下的无匹配文本，忽略。`);
          }
        } else {
          // 已唤醒状态：匹配休眠词或传回指令
          const sleepMatch = text.match(sleepWordRegexRef.current);
          if (sleepMatch) {
            console.log(`[Speech] 匹配到休眠词! 识别文本: "${sleepMatch[0]}"`);
            setIsAwake(false);
            continue;
          }

          // 如果用户在已唤醒状态下重复说了唤醒词（例如再次说 "hi canvas"），我们应将其过滤掉，避免发送给后端
          let processText = text;
          const wakeMatch = text.match(wakeWordRegexRef.current);
          if (wakeMatch) {
            processText = wakeMatch[3]?.trim() || "";
            console.log(
              `[Speech] 已唤醒状态下过滤掉重复的唤醒词，剩余指令: "${processText}"`,
            );
          }

          // 清理尾部标点
          const cleanText = processText
            .replace(/^[.,，。?？!\s]+|[.,，。?？!\s]+$/g, "")
            .trim();
          if (cleanText) {
            console.log(`[Speech] 触发指令发送: "${cleanText}"`);
            onResultRef.current(cleanText);
          } else {
            console.log(`[Speech] 空指令或仅包含唤醒词，不发送给后端。`);
          }
        }
      }
    };

    recognitionRef.current = rec;

    // 注册 TTS 状态监听事件，用来在播报时释放麦克风，播报完毕自动重新捕获
    const handleTTSStart = () => {
      console.log("[Speech] 监听到 TTS 开始播放，物理挂起麦克风以避免回音干扰");
      isMutedByTTSRef.current = true;
      try {
        rec.abort();
      } catch {
        // ignore
      }
    };

    const handleTTSEnd = () => {
      console.log("[Speech] 监听到 TTS 播放结束，重新拉起麦克风监听");
      isMutedByTTSRef.current = false;
      startMic();
    };

    window.addEventListener("tts-start", handleTTSStart);
    window.addEventListener("tts-end", handleTTSEnd);

    // 首次页面加载，自动开启物理麦克风常驻监听（使用安全的自恢复启动）
    startMic();

    return () => {
      isUnmounted = true;
      window.removeEventListener("tts-start", handleTTSStart);
      window.removeEventListener("tts-end", handleTTSEnd);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    // 手动点击开启唤醒状态（不需说唤醒词）
    console.log("[Speech] 手动触发唤醒...");
    setIsAwake(true);

    // 强制解除 TTS 造成的静音挂起状态
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tts-end")); // 这会使得组件内的状态也被清理并重启物理麦克风
    }

    // 确保物理麦克风是开启状态
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // 忽略已启动
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    // 手动点击关闭唤醒状态（回到后台监听唤醒词）
    console.log("[Speech] 手动触发休眠...");
    setIsAwake(false);
  }, []);

  return { isRecording: isAwake, isSupported, startRecording, stopRecording };
}
