import { Button } from "@/components/ui/button";
import { Github, Twitter, Mail, Heart } from "lucide-react";
import logo from "@/assets/learnova-logo.png";

export const Footer = () => {
  return (
    <footer className="mt-auto bg-[#4C1D3D]/40 backdrop-blur-sm border-t border-pink-700/30 py-2">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Brand */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="LearnNova" className="h-6 w-6" />
              <span className="text-lg font-bold text-[#FFBB94]">LearnNova</span>
            </div>
            <p className="hidden md:block text-pink-100 text-xs leading-snug max-w-sm">
              Study beyond the stars with AI-powered learning tools that adapt to your unique learning style.
            </p>
            <div className="flex space-x-3">
              <Button variant="ghost" size="sm" className="text-pink-200 hover:text-[#FFBB94]">
                <Github className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-pink-200 hover:text-[#FFBB94]">
                <Twitter className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-pink-200 hover:text-[#FFBB94]">
                <Mail className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-1">
            <h3 className="font-semibold text-[#FFBB94] text-sm">Product</h3>
            <div className="flex flex-col gap-1.5">
              <Button variant="ghost" className="h-auto p-0 text-pink-200 hover:text-[#FFBB94] justify-start text-sm w-fit">
                Features
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-pink-200 hover:text-[#FFBB94] justify-start text-sm w-fit">
                Study Tools
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-pink-200 hover:text-[#FFBB94] justify-start text-sm w-fit">
                AI Generator
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-pink-200 hover:text-[#FFBB94] justify-start text-sm w-fit">
                Collaboration
              </Button>
            </div>
          </div>

          {/* Company */}
          <div className="space-y-1">
            <h3 className="font-semibold text-[#FFBB94] text-sm">Company</h3>
            <div className="flex flex-col gap-1.5">
              <Button variant="ghost" className="h-auto p-0 text-pink-200 hover:text-[#FFBB94] justify-start text-sm w-fit">
                About
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-pink-200 hover:text-[#FFBB94] justify-start text-sm w-fit">
                Blog
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-pink-200 hover:text-[#FFBB94] justify-start text-sm w-fit">
                Privacy
              </Button>
              <Button variant="ghost" className="h-auto p-0 text-pink-200 hover:text-[#FFBB94] justify-start text-sm w-fit">
                Terms
              </Button>
            </div>
          </div>
        </div>
        <div className="border-t border-pink-700/30 mt-2 pt-2 text-center">
          <p className="text-pink-200 text-xs flex items-center justify-center gap-2">
            <span>Made with</span>
            <Heart className="w-4 h-4 text-[#FB9590] fill-current" />
            <span>for learners everywhere</span>
          </p>
          <p className="text-[11px] text-pink-300 mt-1">© 2024 LearnNova. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};