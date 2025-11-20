import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      // Ensure Flask session is established whenever Firebase user is available
      try {
        if (u) {
          const idToken = await u.getIdToken();
          const resp = await fetch("/api/firebase-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ idToken }),
          });
          if (!resp.ok) {
            console.debug("/api/firebase-login (state sync) failed", resp.status);
          }
        }
      } catch (e) {
        // ignore in UI
      }
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
    // Sync Firebase login to Flask session
    try {
      const current = auth.currentUser;
      if (current) {
        const idToken = await current.getIdToken();
        const resp = await fetch("/api/firebase-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ idToken }),
        });
        if (!resp.ok) {
          // swallow in UI but log for debugging
          console.debug("/api/firebase-login failed", resp.status);
        }
      }
    } catch (e) {
      // ignore; backend session may already be set or will be set on next effect
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signOutUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
