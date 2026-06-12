// Estimate semantic positions (九宫格) based on x, y coordinates and canvas size
export const getSemanticPosition = (x: number, y: number, canvasW: number, canvasH: number): string => {
  const xPct = x / canvasW;
  const yPct = y / canvasH;
  
  if (xPct < 0.35 && yPct < 0.35) return 'top_left';
  if (xPct > 0.65 && yPct < 0.35) return 'top_right';
  if (xPct < 0.35 && yPct > 0.65) return 'bottom_left';
  if (xPct > 0.65 && yPct > 0.65) return 'bottom_right';
  if (xPct < 0.35) return 'center_left';
  if (xPct > 0.65) return 'center_right';
  return 'center';
};

// Convert semantic position (九宫格) back to physical pixel coordinates on the canvas
export const getCoordsFromSemantic = (pos: string, canvasW: number, canvasH: number): { x: number; y: number } => {
  const paddingX = Math.max(100, canvasW * 0.15);
  const paddingY = Math.max(100, canvasH * 0.15);
  
  switch (pos) {
    case 'top_left':
      return { x: paddingX, y: paddingY };
    case 'top_right':
      return { x: canvasW - paddingX - 200, y: paddingY };
    case 'bottom_left':
      return { x: paddingX, y: canvasH - paddingY - 200 };
    case 'bottom_right':
      return { x: canvasW - paddingX - 200, y: canvasH - paddingY - 200 };
    case 'center_left':
      return { x: paddingX, y: canvasH / 2 - 100 };
    case 'center_right':
      return { x: canvasW - paddingX - 200, y: canvasH / 2 - 100 };
    case 'center':
    default:
      return { x: canvasW / 2 - 100, y: canvasH / 2 - 100 };
  }
};
