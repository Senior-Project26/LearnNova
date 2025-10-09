import { Navigation } from "@/components/ui/navigation";
import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { StarField } from "@/components/cosmic/StarField";

interface ProtectedLayoutProps {
  children: ReactNode;
}

const ProtectedLayout = ({ children }: ProtectedLayoutProps) => {
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Always visible on top */}
      <Navigation />

      {/* Cosmic overlay for all protected pages */}
      <div className="pointer-events-none absolute inset-0">
        {/* Soft nebula glows (lighter than home) */}
        <motion.div
          className="absolute -top-20 -left-20 h-[35vh] w-[35vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,187,148,0.18), transparent 60%)" }}
          animate={{ x: [0, 14, -6, 0], y: [0, -8, 6, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-28 -right-20 h-[40vh] w-[40vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(251,149,144,0.16), transparent 60%)" }}
          animate={{ x: [0, -10, 8, 0], y: [0, 8, -6, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Subtle twinkle layers */}
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 25% 30%, rgba(255,255,255,0.45) 0, transparent 60%)," +
              "radial-gradient(1px 1px at 65% 70%, rgba(255,255,255,0.28) 0, transparent 60%)",
          }}
          animate={{ backgroundPosition: ["0px 0px", "14px 10px", "-6px -4px", "0px 0px"] }}
          transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
        />
        {/* Parallax starfields */}
        <StarField count={45} depth={0.02} mouse={mouse} />
        <StarField count={25} depth={0.05} mouse={mouse} />
      </div>

      {/* Page content, with padding to not overlap nav */}
      <main
        className="relative z-10 pt-20"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
          setMouse({ x: nx, y: ny });
        }}
        onMouseLeave={() => setMouse(null)}
      >
        {children}
      </main>
    </div>
  );
};

export default ProtectedLayout;
