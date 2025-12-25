import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  color?: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, color = '#22c55e' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bars: number[] = Array(5).fill(10);
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const barWidth = 8;
      const gap = 6;

      if (isActive) {
        // Randomize bar heights smoothly to simulate talking
        bars = bars.map(h => {
          const target = Math.random() * 40 + 10;
          return h + (target - h) * 0.2;
        });
      } else {
        // Return to baseline
        bars = bars.map(h => h + (10 - h) * 0.2);
      }

      bars.forEach((height, i) => {
        const offset = (i - 2) * (barWidth + gap);
        
        ctx.fillStyle = color;
        // Draw rounded pill shape
        ctx.beginPath();
        ctx.roundRect(centerX + offset - barWidth/2, centerY - height/2, barWidth, height, 10);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={200} 
      height={100} 
      className="w-[100px] h-[50px]"
    />
  );
};

export default Visualizer;