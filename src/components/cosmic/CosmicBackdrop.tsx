import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StarField } from "@/components/cosmic/StarField";

export const CosmicBackdrop = () => {
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nx = (e.clientX / vw) * 2 - 1;
      const ny = (e.clientY / vh) * 2 - 1;
      setMouse({ x: nx, y: ny });
    };
    const onLeave = () => setMouse(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        aria-hidden
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Nebula glows */}
        <motion.div
          className="absolute -top-24 -left-24 h-[45vh] w-[45vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,187,148,0.22), transparent 60%)" }}
          animate={{ x: [0, 18, -8, 0], y: [0, -10, 8, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -right-24 h-[50vh] w-[50vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(251,149,144,0.20), transparent 60%)" }}
          animate={{ x: [0, -12, 10, 0], y: [0, 10, -8, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Twinkling star gradients */}
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.55) 0, transparent 60%)," +
              "radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.35) 0, transparent 60%)," +
              "radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.45) 0, transparent 60%)," +
              "radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,0.3) 0, transparent 60%)",
          }}
          animate={{ backgroundPosition: ["0px 0px", "18px 12px", "-8px -6px", "0px 0px"] }}
          transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 15% 15%, rgba(255,255,255,0.3) 0, transparent 60%)," +
              "radial-gradient(1px 1px at 70% 40%, rgba(255,255,255,0.22) 0, transparent 60%)," +
              "radial-gradient(1px 1px at 45% 60%, rgba(255,255,255,0.26) 0, transparent 60%)",
          }}
          animate={{ backgroundPosition: ["0px 0px", "-20px 16px", "12px -10px", "0px 0px"] }}
          transition={{ duration: 42, repeat: Infinity, ease: "linear" }}
        />
        {/* Interactive starfield layers (parallax follows mouse) */}
        <StarField count={55} depth={0.02} mouse={mouse} />
        <StarField count={30} depth={0.05} mouse={mouse} />
      </motion.div>
    </div>
  );
}

export default CosmicBackdrop;
