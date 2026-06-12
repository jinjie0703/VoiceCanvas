import { useState, useEffect, useRef } from 'react';

interface UseSpeechRecognitionProps {
  onResult: (text: string) => void;
  onListeningStateChange?: (isRecording: boolean) => void;
}

export function useSpeechRecognition({ onResult, onListeningStateChange }: UseSpeechRecognitionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'zh-CN';

      rec.onstart = () => {
        setIsRecording(true);
        onListeningStateChange?.(true);
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setIsRecording(false);
        onListeningStateChange?.(false);
      };

      rec.onend = () => {
        setIsRecording(false);
        onListeningStateChange?.(false);
      };

      rec.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        onResult(resultText);
      };

      recognitionRef.current = rec;
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        recognitionRef.current.stop();
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  return { isRecording, isSupported, startRecording, stopRecording };
}
