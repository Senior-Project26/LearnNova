import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, BookOpen, User, Settings } from "lucide-react";
import logo from "@/assets/learnova-logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOutUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Track Flask session (backend) login state
  const [backendLoggedIn, setBackendLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/session", { credentials: "include" });
        if (!mounted) return;
        setBackendLoggedIn(res.ok);
      } catch {
        if (!mounted) return;
        setBackendLoggedIn(false);
      }
    })();
    return () => { mounted = false; };
  }, [location.pathname]);

  // Helper to highlight active link
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#4C1D3D]/90 backdrop-blur-xl border-b border-pink-900/30 shadow-lg shadow-pink-900/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-3">
              <img src={logo} alt="LearnNova" className="h-8 w-8" />
              <h1 className="text-xl font-bold text-[#FFBB94] tracking-wide">
                LearnNova
              </h1>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {[
              { path: "/study", label: "Study", icon: <BookOpen className="w-4 h-4 mr-2" /> },
              { path: "/dashboard", label: "Dashboard" },
              { path: "/resources", label: "Resources" },
              { path: "/profile", label: "Profile", icon: <User className="w-4 h-4 mr-2" /> },
              { path: "/settings", label: "Settings", icon: <Settings className="w-4 h-4 mr-2" /> },
            ].map((item) => (
              <Button
                asChild
                key={item.path}
                variant="ghost"
                className={`font-medium transition-all px-3 py-2 rounded-md
                  ${
                    isActive(item.path)
                      ? "bg-[#852E4E] text-[#FFBB94] shadow-lg shadow-pink-900/30"
                      : "text-[#FFBB94] hover:bg-[#A33757]/50 hover:text-[#FFBB94]"
                  }`}
              >
                <Link to={item.path} className="flex items-center">
                  {item.icon}
                  {item.label}
                </Link>
              </Button>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {backendLoggedIn === true ? (
              <Button
                onClick={async () => {
                  try {
                    await fetch("/api/logout", {
                      method: "POST",
                      credentials: "include",
                    });
                  } catch {}
                  try {
                    await signOutUser();
                  } catch {}
                  navigate("/signin", { replace: true });
                }}
                className="bg-[#4C1D3D] hover:bg-[#852E4E] text-[#FFBB94] border border-pink-700/40 font-semibold shadow-md shadow-pink-900/30 transition-all"
              >
                Sign Out
              </Button>
            ) : (
              <Button
                asChild
                className="bg-[#DC586D] hover:bg-[#A33757] text-white font-semibold shadow-lg shadow-pink-900/30 transition-all"
              >
                <Link to="/signin">Sign In / Sign Up</Link>
              </Button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-[#FFBB94]"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-2 slide-up">
            {[
              { path: "/study", label: "Study", icon: <BookOpen className="w-4 h-4 mr-2" /> },
              { path: "/dashboard", label: "Dashboard" },
              { path: "/resources", label: "Resources" },
              { path: "/profile", label: "Profile", icon: <User className="w-4 h-4 mr-2" /> },
              { path: "/settings", label: "Settings", icon: <Settings className="w-4 h-4 mr-2" /> },
            ].map((item) => (
              <Button
                asChild
                key={item.path}
                variant="ghost"
                className={`w-full justify-start font-medium transition-all rounded-md
                  ${
                    isActive(item.path)
                      ? "bg-[#852E4E] text-[#FFBB94]"
                      : "text-[#FFBB94] hover:bg-[#A33757]/50 hover:text-[#FFBB94]"
                  }`}
              >
                <Link to={item.path} className="flex items-center">
                  {item.icon}
                  {item.label}
                </Link>
              </Button>
            ))}

            <div className="pt-2 space-y-2">
              {backendLoggedIn ? (
                <Button
                  onClick={async () => {
                    try {
                      await fetch("/api/logout", {
                        method: "POST",
                        credentials: "include",
                      });
                    } catch (e) {
                      console.warn("Failed to log out from backend session", e);
                    }
                    try {
                      await signOutUser();
                    } catch (e) {
                      console.warn("Failed to sign out Firebase auth user", e);
                    }
                    navigate("/signin", { replace: true });
                  }}
                  className="w-full bg-[#4C1D3D] hover:bg-[#852E4E] text-[#FFBB94] border border-pink-700/40"
                >
                  Sign Out
                </Button>
              ) : (
                <Button
                  asChild
                  className="w-full bg-[#DC586D] hover:bg-[#A33757] text-white font-semibold shadow-lg shadow-pink-900/30 transition-all"
                >
                  <Link to="/signin">Sign In / Sign Up</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
