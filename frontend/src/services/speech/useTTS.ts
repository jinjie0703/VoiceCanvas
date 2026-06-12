export const useTTS = () => {
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) {
      console.warn("Speech synthesis is not supported in this browser.");
      return;
    }
    
    // Cancel any ongoing speech to ensure real-time feedback
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Optimize for Chinese if available, or fallback to default
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.includes("zh"));
    if (zhVoice) {
      utterance.voice = zhVoice;
    }
    
    utterance.rate = 1.1; // Slightly faster for snappier feedback
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  };

  const cancel = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  return { speak, cancel };
};
