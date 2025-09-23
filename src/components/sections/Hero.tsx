import { Button } from "@/components/ui/button";
import { StarField } from "@/components/cosmic/StarField";
import { ArrowRight, Sparkles, Brain } from "lucide-react";
import heroImage from "@/assets/hero-space-bg.jpg";

export const Hero = () => {
  return (
    <section 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${heroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/90 via-muted/80 to-background/95" />
      
      {/* Animated Stars */}
      <StarField count={80} />
      
      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        <div className="space-y-8 slide-up">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-highlight/30 float">
              <Brain className="w-12 h-12 text-highlight" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-foreground via-accent to-highlight bg-clip-text text-transparent leading-tight">
              Learn smarter.
            </h1>
            <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-highlight via-accent to-primary bg-clip-text text-transparent">
              Study beyond the stars.
            </h2>
          </div>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            AI-powered study platform that adapts to your learning style. Create flashcards, generate quizzes, and collaborate with fellow learners in a cosmic learning experience.
          </p>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-6 text-sm md:text-base">
            <div className="flex items-center space-x-2 text-highlight">
              <Sparkles className="w-4 h-4" />
              <span>AI-Generated Content</span>
            </div>
            <div className="flex items-center space-x-2 text-accent">
              <Sparkles className="w-4 h-4" />
              <span>Adaptive Learning</span>
            </div>
            <div className="flex items-center space-x-2 text-primary">
              <Sparkles className="w-4 h-4" />
              <span>100% Free Forever</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              size="lg" 
              className="btn-cosmic text-lg px-8 py-4 group"
            >
              Start Learning
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-4 border-2 border-highlight/50 text-foreground hover:bg-highlight/10 hover:border-highlight cosmic-glow"
            >
              Explore Features
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-12 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary">10K+</div>
              <div className="text-sm text-muted-foreground">Study Sets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-accent">50K+</div>
              <div className="text-sm text-muted-foreground">Students</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-highlight">95%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-secondary">24/7</div>
              <div className="text-sm text-muted-foreground">AI Support</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};