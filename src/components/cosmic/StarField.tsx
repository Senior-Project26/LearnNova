import { useEffect, useState } from "react";

interface Star {
  id: number;
  x: number;
  y: number;
  delay: number;
  size: number;
}

export const StarField = ({ count = 50 }: { count?: number }) => {
  const [stars, setStars] = useState<Star[]>([]);

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
    <div className="starfield">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute text-highlight opacity-30"
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