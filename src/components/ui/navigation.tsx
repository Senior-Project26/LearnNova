import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, BookOpen, User, Settings } from "lucide-react";
import logo from "@/assets/learnova-logo.png";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOutUser } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 bg-muted/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-3">
              <img src={logo} alt="LearnNova" className="h-8 w-8" />
              <h1 className="text-xl font-bold text-foreground">LearnNova</h1>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Button asChild variant="ghost" className="text-foreground hover:text-accent">
              <Link to="/study">
                <BookOpen className="w-4 h-4 mr-2" />
                Study
              </Link>
            </Button>
            <Button asChild variant="ghost" className="text-foreground hover:text-accent">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" className="text-foreground hover:text-accent">
              <Link to="/profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </Button>
            <Button asChild variant="ghost" className="text-foreground hover:text-accent">
              <Link to="/settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </Button>
          </div>
          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <Button onClick={signOutUser} variant="ghost" className="text-foreground hover:text-accent">
                Sign Out
              </Button>
            ) : (
              <Button asChild className="btn-cosmic">
                <Link to="/signin">Sign in / Sign up</Link>
              </Button>
            )}
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
            <Button asChild variant="ghost" className="w-full justify-start text-foreground">
              <Link to="/study">
                <BookOpen className="w-4 h-4 mr-2" />
                Study
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start text-foreground">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start text-foreground">
              <Link to="/profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start text-foreground">
              <Link to="/settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </Button>
            <div className="pt-2 space-y-2">
              {user ? (
                <Button onClick={signOutUser} variant="ghost" className="w-full text-foreground">
                  Sign Out
                </Button>
              ) : (
                <Button asChild className="w-full btn-cosmic">
                  <Link to="/signin">Sign in / Sign up</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};