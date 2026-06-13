import { useState, useEffect, useRef } from 'react';

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
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  start: () => void;
  stop: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: { new (): ISpeechRecognition };
  webkitSpeechRecognition?: { new (): ISpeechRecognition };
}

export function useSpeechRecognition({ 
  onResult, 
  onListeningStateChange,
  wakeWordRegex = /(hi|嗨|hai|海)[\s,，]*(canvas|画板|画布)(.*)/i,
  sleepWordRegex = /(关闭|退出|休息)[\s,，]*(canvas|画板|画布)?/i,
}: UseSpeechRecognitionProps) {
  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as WindowWithSpeech;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  });
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const onResultRef = useRef(onResult);
  const onListeningStateChangeRef = useRef(onListeningStateChange);
  const intentionallyStoppedRef = useRef(false);

  const [isAwake, setIsAwake] = useState(false);
  const isAwakeRef = useRef(false);

  useEffect(() => {
    onResultRef.current = onResult;
    onListeningStateChangeRef.current = onListeningStateChange;
  });

  useEffect(() => {
    isAwakeRef.current = isAwake;
    onListeningStateChangeRef.current?.(isAwake);
  }, [isAwake]);

  useEffect(() => {
    const win = window as unknown as WindowWithSpeech;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'zh-CN';

      rec.onstart = () => {
        // Physical mic is on, but logical awake state is separate
      };

      rec.onend = () => {
        if (!intentionallyStoppedRef.current) {
          try {
            rec.start();
          } catch {
            // ignore error if it's already started
          }
        }
      };

      rec.onerror = (e: unknown) => {
        const err = e as { error?: string };
        if (err.error === 'not-allowed') {
          intentionallyStoppedRef.current = true;
          setIsAwake(false);
        }
      };

      rec.onresult = (event: unknown) => {
        const speechEvent = event as { results: { isFinal: boolean; [key: number]: { transcript: string } }[] };
        const results = speechEvent.results;
        if (!results || results.length === 0) return;
        const latestResult = results[results.length - 1];
        if (!latestResult.isFinal) return;

        const text = latestResult[0].transcript.toLowerCase().trim();
        if (!text) return;

        if (!isAwakeRef.current) {
          // Listen for wake word
          const match = text.match(wakeWordRegex);
          if (match) {
            setIsAwake(true);
            const command = match[3] ? match[3].trim() : text.replace(wakeWordRegex, "").trim();
            if (command) {
              onResultRef.current(command);
            }
          }
        } else {
          // Listen for sleep word or standard command
          const sleepMatch = text.match(sleepWordRegex);
          if (sleepMatch) {
            setIsAwake(false);
            return;
          }
          onResultRef.current(text);
        }
      };

      recognitionRef.current = rec;
      // Start physical listening immediately in the background
      try {
        rec.start();
      } catch {
        // ignore initialization errors
      }
    }

    return () => {
      intentionallyStoppedRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const startRecording = () => {
    setIsAwake(true);
  };

  const stopRecording = () => {
    setIsAwake(false);
  };

  return { isRecording: isAwake, isSupported, startRecording, stopRecording };
}
