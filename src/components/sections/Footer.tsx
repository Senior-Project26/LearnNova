import { Button } from "@/components/ui/button";
import { Github, Twitter, Mail, Heart } from "lucide-react";
import logo from "@/assets/learnova-logo.png";

export const Footer = () => {
  return (
    <footer className="bg-gradient-to-t from-muted to-background border-t border-white/10 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="LearnNova" className="h-8 w-8" />
              <span className="text-xl font-bold text-foreground">LearnNova</span>
            </div>
            <p className="text-muted-foreground">
              Study beyond the stars with AI-powered learning tools that adapt to your unique learning style.
            </p>
            <div className="flex space-x-3">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-accent">
                <Github className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-accent">
                <Twitter className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-accent">
                <Mail className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Product</h3>
            <div className="space-y-2">
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Features
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Study Tools
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                AI Generator
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Collaboration
              </Button>
            </div>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Support</h3>
            <div className="space-y-2">
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Help Center
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Community
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Contact Us
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Status
              </Button>
            </div>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Company</h3>
            <div className="space-y-2">
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                About
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Blog
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Privacy
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-accent justify-start">
                Terms
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 text-center">
          <p className="text-muted-foreground flex items-center justify-center space-x-2">
            <span>Made with</span>
            <Heart className="w-4 h-4 text-primary fill-current" />
            <span>for learners everywhere</span>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            © 2024 LearnNova. All rights reserved. Free forever, for everyone.
          </p>
        </div>
      </div>
    </footer>
  );
};