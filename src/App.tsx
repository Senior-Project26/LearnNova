import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CosmicBackdrop from "@/components/cosmic/CosmicBackdrop";

import Index from "./pages/Index";
import Study from "./pages/Study";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import Upload from "./pages/Upload";
import Summary from "./pages/Summary";
import NotFound from "./pages/NotFound";
import Quiz from "./pages/Quiz";
import StudyGuide from "./pages/StudyGuide";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProtectedLayout from "@/components/ProtectedLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <Router>
          <CosmicBackdrop />
          <Routes>
            {/* Public routes without navbar */}
            <Route path="/" element={<Index />} />
            <Route path="/signin" element={<SignIn />} />

            {/* Public routes with navbar */}
            <Route
              path="/upload"
              element={
                <ProtectedLayout>
                  <Upload />
                </ProtectedLayout>
              }
            />
            <Route
              path="/summary"
              element={
                <ProtectedLayout>
                  <Summary />
                </ProtectedLayout>
              }
            />
            <Route
              path="/quiz"
              element={
                <ProtectedLayout>
                  <Quiz />
                </ProtectedLayout>
              }
            />
            <Route
              path="/study-guide"
              element={
                <ProtectedLayout>
                  <StudyGuide />
                </ProtectedLayout>
              }
            />

            {/* Protected routes (with Navigation bar) */}
            <Route
              path="/study"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Study />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Dashboard />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Profile />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Settings />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />

            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;