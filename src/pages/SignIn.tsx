import { useEffect } from "react";
import { useLocation, useNavigate, Location } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigation } from "@/components/ui/navigation";
import { useAuth } from "@/contexts/AuthContext";

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

  useEffect(() => {
    if (!loading && user) {
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
            <Button className="w-full btn-cosmic" onClick={handleGoogle}>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SignIn;
