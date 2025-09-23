import { Navigation } from "@/components/ui/navigation";
import { Hero } from "@/components/sections/Hero";
import { Features } from "@/components/sections/Features";
import { Footer } from "@/components/sections/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <Hero />
        <Features />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
