import { useState, useEffect, useRef } from 'react';

interface UseSpeechRecognitionProps {
  onResult: (text: string) => void;
  onListeningStateChange?: (isRecording: boolean) => void;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  start: () => void;
  stop: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: { new (): ISpeechRecognition };
  webkitSpeechRecognition?: { new (): ISpeechRecognition };
}

export function useSpeechRecognition({ onResult, onListeningStateChange }: UseSpeechRecognitionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as WindowWithSpeech;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  });
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const onResultRef = useRef(onResult);
  const onListeningStateChangeRef = useRef(onListeningStateChange);

  useEffect(() => {
    onResultRef.current = onResult;
    onListeningStateChangeRef.current = onListeningStateChange;
  });

  useEffect(() => {
    const win = window as unknown as WindowWithSpeech;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'zh-CN';

      rec.onstart = () => {
        setIsRecording(true);
        onListeningStateChangeRef.current?.(true);
      };

      rec.onerror = (e: unknown) => {
        console.error('Speech recognition error:', e);
        setIsRecording(false);
        onListeningStateChangeRef.current?.(false);
      };

      rec.onend = () => {
        setIsRecording(false);
        onListeningStateChangeRef.current?.(false);
      };

      rec.onresult = (event: { results: { transcript: string }[][] }) => {
        const resultText = event.results[0][0].transcript;
        onResultRef.current(resultText);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
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
