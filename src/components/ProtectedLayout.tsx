import { Navigation } from "@/components/ui/navigation";
import { ReactNode } from "react";

interface ProtectedLayoutProps {
  children: ReactNode;
}

const ProtectedLayout = ({ children }: ProtectedLayoutProps) => {
  return (
    <div className="min-h-screen">
      {/* Always visible on top */}
      <Navigation />

      {/* Page content, with padding to not overlap nav */}
      <main className="pt-20">{children}</main>
    </div>
  );
};

export default ProtectedLayout;
