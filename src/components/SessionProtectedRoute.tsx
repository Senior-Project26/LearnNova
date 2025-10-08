import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { clientLog } from "@/lib/clientLog";

const SessionProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        const res = await fetch("/api/session", {
          credentials: "include",
        });
        clientLog("info", "SessionProtectedRoute: /api/session status", { status: res.status, path: location.pathname });
        if (!mounted) return;
        if (res.ok) {
          setAuthorized(true);
        } else if (attempt < 2) {
          // Small retry window to avoid racing Set-Cookie after redirect
          setAuthorized(null);
          setTimeout(() => setAttempt((a) => a + 1), 150);
        } else {
          setAuthorized(false);
        }
      } catch {
        clientLog("error", "SessionProtectedRoute: /api/session failed", { path: location.pathname });
        if (!mounted) return;
        setAuthorized(false);
      }
    };
    checkSession();
    return () => {
      mounted = false;
    };
  }, [location.pathname, attempt]);

  if (authorized === null) {
    clientLog("info", "SessionProtectedRoute: waiting for session check", { path: location.pathname });
    return (
      <div className="w-full h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!authorized) {
    clientLog("warn", "SessionProtectedRoute: unauthorized, redirecting to /signin", { from: location.pathname });
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return children;
};

export default SessionProtectedRoute;
