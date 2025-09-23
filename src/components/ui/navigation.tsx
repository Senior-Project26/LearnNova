import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, BookOpen, User, Settings } from "lucide-react";
import logo from "@/assets/learnova-logo.png";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-muted/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img src={logo} alt="LearnNova" className="h-8 w-8" />
            <h1 className="text-xl font-bold text-foreground">LearnNova</h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Button variant="ghost" className="text-foreground hover:text-accent">
              <BookOpen className="w-4 h-4 mr-2" />
              Study
            </Button>
            <Button variant="ghost" className="text-foreground hover:text-accent">
              Dashboard
            </Button>
            <Button variant="ghost" className="text-foreground hover:text-accent">
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button variant="ghost" className="text-foreground hover:text-accent">
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            <Button variant="ghost" className="text-foreground hover:text-accent">
              Sign In
            </Button>
            <Button className="btn-cosmic">
              Sign Up
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-foreground"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-2 slide-up">
            <Button variant="ghost" className="w-full justify-start text-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              Study
            </Button>
            <Button variant="ghost" className="w-full justify-start text-foreground">
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start text-foreground">
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button variant="ghost" className="w-full justify-start text-foreground">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <div className="pt-2 space-y-2">
              <Button variant="ghost" className="w-full text-foreground">
                Sign In
              </Button>
              <Button className="w-full btn-cosmic">
                Sign Up
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};