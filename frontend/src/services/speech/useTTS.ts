export const useTTS = () => {
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) {
      console.warn("Speech synthesis is not supported in this browser.");
      return;
    }

    // Cancel any ongoing speech to ensure real-time feedback
    window.speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent("tts-end")); // 确保前一个播报状态被清除

    const utterance = new SpeechSynthesisUtterance(text);

    // Optimize for Chinese if available, or fallback to default
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find((v) => v.lang.includes("zh"));
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    utterance.rate = 1.1; // Slightly faster for snappier feedback
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      window.dispatchEvent(new CustomEvent("tts-start"));
      // 安全兜底：如果浏览器 TTS 引擎卡死，最长 15 秒后强制释放麦克风
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("tts-end"));
      }, 15000);
    };

    utterance.onend = () => {
      window.dispatchEvent(new CustomEvent("tts-end"));
    };

    utterance.onerror = (event) => {
      console.warn("TTS Playback failed or was interrupted:", event.error);
      window.dispatchEvent(new CustomEvent("tts-end"));
    };

    // 解决 Chrome 的一个著名 Bug：如果 utterance 不挂载到全局，会被垃圾回收导致 onend 永远不触发
    interface WindowWithUtterance extends Window {
      currentUtterance?: SpeechSynthesisUtterance;
    }
    (window as WindowWithUtterance).currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const cancel = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.dispatchEvent(new CustomEvent("tts-end"));
    }
  };

  return { speak, cancel };
};
