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
  wakeWordRegex = /(hi|hey|hello|嗨|hai|海|哈喽|你好)[\s,，]*(canvas|画板|画布)(.*)/i,
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
  const wakeWordRegexRef = useRef(wakeWordRegex);
  const sleepWordRegexRef = useRef(sleepWordRegex);

  const [isAwake, setIsAwake] = useState(false);
  const isAwakeRef = useRef(false);

  useEffect(() => {
    onResultRef.current = onResult;
    onListeningStateChangeRef.current = onListeningStateChange;
    wakeWordRegexRef.current = wakeWordRegex;
    sleepWordRegexRef.current = sleepWordRegex;
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
          setTimeout(() => {
            try {
              if (!intentionallyStoppedRef.current) {
                rec.start();
              }
            } catch {
              // ignore error if it's already started
            }
          }, 1000); // 1s backoff to prevent tight CPU loop
        }
      };

      rec.onerror = (e: unknown) => {
        const err = e as { error?: string };
        if (err.error === 'not-allowed') {
          intentionallyStoppedRef.current = true;
          setIsAwake(false);
        } else if (err.error === 'network' || err.error === 'aborted') {
          // Will be restarted by onend with backoff
        }
      };

      rec.onresult = (event: unknown) => {
        const speechEvent = event as { resultIndex: number, results: { isFinal: boolean; [key: number]: { transcript: string } }[] };
        const results = speechEvent.results;
        if (!results || results.length === 0) return;

        for (let i = speechEvent.resultIndex; i < results.length; i++) {
          const result = results[i];
          if (!result.isFinal) continue;

          const text = result[0].transcript.toLowerCase().trim();
          if (!text) continue;

          if (!isAwakeRef.current) {
            // Listen for wake word
            const match = text.match(wakeWordRegexRef.current);
            if (match) {
              setIsAwake(true);
              const remainingText = match[3]?.trim();
              if (remainingText) {
                onResultRef.current(remainingText);
              }
            }
          } else {
            // Listen for sleep word
            const sleepMatch = text.match(sleepWordRegexRef.current);
            if (sleepMatch) {
              setIsAwake(false);
              continue;
            }
            onResultRef.current(text);
          }
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
