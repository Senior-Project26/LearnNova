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
import SignUp from "./pages/SignUp";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedLayout from "@/components/ProtectedLayout";
import SessionProtectedRoute from "@/components/SessionProtectedRoute";
import Upload from "./pages/Upload";
import Summary from "./pages/Summary";
import NotFound from "./pages/NotFound";
import Quiz from "./pages/Quiz";
import StudyGuide from "./pages/StudyGuide";
import Flashcards from "./pages/Flashcards";
import StudySet from "./pages/StudySet";
import ChatPage from "./pages/Chat";
import LearningResources from "./pages/LearningResources";
import FloatingChatBubble from "@/components/chat/FloatingChatBubble";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <Router>
          <CosmicBackdrop />
          <FloatingChatBubble />
          <Routes>
            {/* Public routes without navbar */}
            <Route path="/" element={<Index />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route
              path="/upload"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <Upload />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />
            <Route
              path="/summary"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <Summary />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />
            <Route
              path="/quiz"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <Quiz />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />
            <Route
              path="/study-guide"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <StudyGuide />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />

            {/* Protected routes (with Navigation bar) */}
            <Route
              path="/flashcards"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <Flashcards />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />
            <Route
              path="/study-set/:sid"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <StudySet />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />
            <Route
              path="/study"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <Study />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <Dashboard />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <Profile />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <Settings />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />
            <Route
              path="/resources"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <LearningResources />
                  </ProtectedLayout>
                </SessionProtectedRoute>
              }
            />

            {/* Chat route */}
            <Route
              path="/chat"
              element={
                <SessionProtectedRoute>
                  <ProtectedLayout>
                    <ChatPage />
                  </ProtectedLayout>
                </SessionProtectedRoute>
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