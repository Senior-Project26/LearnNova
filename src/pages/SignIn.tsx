import { useEffect, useState } from "react";
import { useLocation, useNavigate, Location, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigation } from "@/components/ui/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { clientLog } from "@/lib/clientLog";

type LocationState = { from?: Location } | null;

const getRedirectPath = (loc: Location & { state?: LocationState }): string => {
  const from = loc.state?.from;
  if (from && typeof from === "object" && "pathname" in from) {
    return (from as Location).pathname || "/dashboard";
  }
  return "/dashboard";
};

const SignIn = () => {
  const { user, loading, signInWithGoogle } = useAuth();
  const location = useLocation() as Location & { state?: LocationState };
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      clientLog("info", "SignIn: Firebase user detected, redirecting", { to: getRedirectPath(location) });
      navigate(getRedirectPath(location), { replace: true });
    }
  }, [user, loading, navigate, location]);

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
      // onAuthStateChanged will trigger and useEffect above will navigate
    } catch (e) {
      console.error("Google sign-in failed", e);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!inputValue.trim() || !password.trim()) {
      setError("Please enter both username/email and password.");
      return;
    }
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ input_value: inputValue.trim(), password: password.trim() }),
      });
      clientLog("info", "SignIn: /api/login response", { status: res.status });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Login failed (${res.status})`);
      // Session cookie set; redirect to dashboard
      clientLog("info", "SignIn: login OK, redirecting to /dashboard");
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      clientLog("error", "SignIn: login failed", { error: e?.message });
      setError(e?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 pt-24 pb-12 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to LearnNova</CardTitle>
            <CardDescription>Sign in to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handlePasswordLogin} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Username/Email</label>
                <input
                  className="w-full border rounded p-2"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Enter your username or email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  className="w-full border rounded p-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
            <div className="relative py-2 text-center text-sm text-muted-foreground">
              <span>or</span>
            </div>
            <Button className="w-full btn-cosmic" onClick={handleGoogle}>
              Continue with Google
            </Button>
            <div className="text-sm text-center">
              Don't have an account? <Link to="/signup" className="underline">Sign up</Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SignIn;
