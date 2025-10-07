import { Navigation } from "@/components/ui/navigation";
import { Footer } from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Index = () => {
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
      <main className="flex-grow flex flex-col items-center justify-center text-center px-4 pt-32 space-y-6 relative">
        {/* subtle glow overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(255,187,148,0.1),transparent_70%)] blur-3xl"></div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text relative z-10"
        >
          Welcome to LearnNova 🚀
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
            variant="outline"
            className="border-pink-400/50 text-white hover:bg-[#852E4E]/40 px-6 py-2 rounded-xl text-lg font-medium"
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
