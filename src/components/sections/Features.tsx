import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Users, Zap, Target, BookOpen, Trophy } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Learning",
    description: "Generate flashcards, quizzes, and summaries from your notes using advanced AI technology.",
    color: "text-primary"
  },
  {
    icon: Target,
    title: "Adaptive Study Plans",
    description: "Personalized learning paths that adapt to your progress and optimize retention.",
    color: "text-accent"
  },
  {
    icon: Users,
    title: "Collaborative Study",
    description: "Study with friends in real-time with shared whiteboards and group competitions.",
    color: "text-highlight"
  },
  {
    icon: Zap,
    title: "Smart Summaries",
    description: "Transform lengthy notes into digestible summaries with 'Explain like I'm 5' mode.",
    color: "text-secondary"
  },
  {
    icon: BookOpen,
    title: "Multi-Format Support",
    description: "Upload PDFs, images, or text files and convert them into interactive study materials.",
    color: "text-primary"
  },
  {
    icon: Trophy,
    title: "Gamified Progress",
    description: "Earn cosmic badges, maintain learning streaks, and compete on leaderboards.",
    color: "text-accent"
  }
];

export const Features = () => {
  return (
    <section className="py-20 px-4 relative">
      <div className="container mx-auto">
        <div className="text-center mb-16 slide-up">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-highlight bg-clip-text text-transparent">
            Learning Features That Matter
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover tools designed to make studying more effective, engaging, and enjoyable than ever before.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="card-cosmic group hover:scale-105 transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader className="text-center">
                <div className="mx-auto p-3 rounded-full bg-gradient-to-r from-highlight/20 to-accent/20 w-fit mb-4 group-hover:animate-float">
                  <feature.icon className={`w-8 h-8 ${feature.color}`} />
                </div>
                <CardTitle className="text-xl font-bold text-foreground">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};