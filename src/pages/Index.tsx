import { Navigation } from "@/components/ui/navigation";
import { Footer } from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import { StarField } from "@/components/cosmic/StarField";

const Index = () => {
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(circle at top left, #4C1D3D 0%, #852E4E 40%, #A33757 70%, #DC586D 90%)",
      }}
    >
      {/* Navbar */}
      <Navigation />

      {/* Hero Section */}
      <main
        className="flex-grow flex flex-col items-center justify-center text-center px-4 pt-32 space-y-6 relative"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1..1
          const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1..1
          setMouse({ x: nx, y: ny });
        }}
        onMouseLeave={() => setMouse(null)}
      >
        {/* animated cosmic background layers */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* Nebula glow */}
          <motion.div
            className="absolute -top-24 -left-24 h-[50vh] w-[50vh] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(255,187,148,0.25), transparent 60%)" }}
            animate={{ x: [0, 20, -10, 0], y: [0, -10, 10, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-32 -right-24 h-[55vh] w-[55vh] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(251,149,144,0.22), transparent 60%)" }}
            animate={{ x: [0, -15, 10, 0], y: [0, 12, -8, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Twinkling stars (two parallax layers) */}
          <motion.div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.6) 0, transparent 60%)," +
                "radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.4) 0, transparent 60%)," +
                "radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.5) 0, transparent 60%)," +
                "radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,0.35) 0, transparent 60%)",
            }}
            animate={{ backgroundPosition: ["0px 0px", "20px 15px", "-10px -5px", "0px 0px"] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(1px 1px at 15% 15%, rgba(255,255,255,0.35) 0, transparent 60%)," +
                "radial-gradient(1px 1px at 70% 40%, rgba(255,255,255,0.25) 0, transparent 60%)," +
                "radial-gradient(1px 1px at 45% 60%, rgba(255,255,255,0.3) 0, transparent 60%)",
            }}
            animate={{ backgroundPosition: ["0px 0px", "-25px 20px", "15px -10px", "0px 0px"] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />
          {/* Interactive starfield layers */}
          <StarField count={60} depth={0.02} mouse={mouse} />
          <StarField count={35} depth={0.06} mouse={mouse} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20, backgroundPosition: "0% 50%" }}
          animate={{ opacity: 1, y: 0, backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 0.6, backgroundPosition: { duration: 9, repeat: Infinity, ease: "linear" } }}
          className="relative z-10 text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-br from-[#FFBB94] via-[#FB9590] to-[#DC586D] text-transparent bg-clip-text drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)] [text-shadow:0_0_8px_rgba(255,255,255,0.35),0_0_18px_rgba(251,149,144,0.35)]"
          style={{ backgroundSize: "200% 200%", WebkitTextStroke: "1px rgba(255,255,255,0.22)" }}
        >
          Welcome to LearnNova
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl text-pink-100 text-lg md:text-xl relative z-10"
        >
          Study smarter, not harder. Create flashcards, generate quizzes, and
          boost your learning with AI ✨
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4 flex-wrap justify-center relative z-10"
        >
          <Button
            asChild
            className="bg-[#DC586D] hover:bg-[#A33757] text-white px-6 py-2 rounded-xl text-lg font-medium shadow-lg hover:shadow-pink-900/30"
          >
            <Link to="/signin">Get Started</Link>
          </Button>

          <Button
            asChild
            className="bg-[#852E4E] hover:bg-[#A33757] text-white px-6 py-2 rounded-xl text-lg font-medium shadow-lg hover:shadow-pink-900/30"
          >
            <Link to="/study">Explore Study Tools</Link>
          </Button>
        </motion.div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
