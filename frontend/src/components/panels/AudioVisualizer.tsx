import React, { useEffect, useState } from "react";

interface AudioVisualizerProps {
  isActive: boolean;
  isThinking: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, isThinking }) => {
  // Only track random heights for active state
  const [randomBars, setRandomBars] = useState<number[]>(Array(15).fill(4));

  useEffect(() => {
    if (!isActive) return;

    // Dynamic wave generation when active
    const interval = setInterval(() => {
      setRandomBars(Array.from({ length: 15 }, () => Math.floor(Math.random() * 30) + 15));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, isThinking]);

  return (
    <div className="h-12.5 flex items-center justify-center my-2">
      <div className={`siri-wave flex items-center gap-1 h-full ${isActive ? 'active' : ''} ${isThinking ? 'thinking' : ''}`}>
        {Array.from({ length: 15 }).map((_, i) => {
          // Add a symmetric height modifier to make it look like a real wave (taller in the middle)
          const distanceToCenter = Math.abs(i - 7);
          const modifier = Math.max(0.2, 1 - distanceToCenter * 0.12); // middle is 1, edges are smaller
          
          let adjustedHeight = 4;
          if (isActive) {
            adjustedHeight = Math.max(6, randomBars[i] * modifier);
          } else if (isThinking) {
            adjustedHeight = 15;
          }
          
          return (
            <span 
              key={i} 
              style={{ height: `${adjustedHeight}px` }} 
              className="block w-1.5 rounded-full bg-slate-300 transition-all duration-150 ease-out"
            />
          );
        })}
      </div>
    </div>
  );
};
