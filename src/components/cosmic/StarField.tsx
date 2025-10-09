import { useEffect, useMemo, useState } from "react";

interface Star {
  id: number;
  x: number;
  y: number;
  delay: number;
  size: number;
}

type Props = {
  count?: number;
  depth?: number; // parallax intensity multiplier (e.g., 0.02 small, 0.06 larger)
  mouse?: { x: number; y: number } | null; // normalized -1..1
};

export const StarField = ({ count = 50, depth = 0.03, mouse = null }: Props) => {
  const [stars, setStars] = useState<Star[]>([]);
  const translate = useMemo(() => {
    if (!mouse) return "translate3d(0,0,0)";
    const tx = (mouse.x || 0) * depth * 20; // convert to px-ish
    const ty = (mouse.y || 0) * depth * 20;
    return `translate3d(${tx}px, ${ty}px, 0)`;
  }, [mouse, depth]);

  useEffect(() => {
    const generateStars = () => {
      const newStars: Star[] = [];
      for (let i = 0; i < count; i++) {
        newStars.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          delay: Math.random() * 3,
          size: Math.random() * 0.5 + 0.5,
        });
      }
      setStars(newStars);
    };

    generateStars();
  }, [count]);

  return (
    <div
      className="starfield absolute inset-0 pointer-events-none"
      style={{ transform: translate, transition: "transform 80ms linear" }}
    >
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute text-pink-200/70 animate-pulse"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            fontSize: `${star.size}rem`,
            animationDelay: `${star.delay}s`,
          }}
        >
          ✦
        </div>
      ))}
    </div>
  );
};