import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Sparkles, Upload, LogOut } from "lucide-react";

const Profile = () => {
  const { user, signOutUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [editing, setEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.photoURL || "");

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleSave = () => {
    // Later: integrate Firebase updateProfile()
    setEditing(false);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12"
      style={{
        background:
          "radial-gradient(circle at top left, #4C1D3D 0%, #852E4E 40%, #A33757 70%, #DC586D 90%)",
      }}
    >
      {/* soft cosmic glow overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(255,187,148,0.15),transparent_70%)] blur-3xl"></div>

      <div className="relative container mx-auto text-white space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-2"
        >
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
            Your Profile
          </h1>
          <p className="text-pink-100">Manage your LearnNova identity ✨</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: User info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 shadow-xl shadow-pink-900/30">
              <CardHeader className="text-center space-y-4">
                <div className="relative mx-auto w-32 h-32 rounded-full overflow-hidden border-4 border-pink-400 shadow-lg shadow-pink-900/30">
                  <img
                    src={
                      avatarPreview ||
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=LearnNova"
                    }
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                  {editing && (
                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-pink-200 text-sm">
                      <Upload className="h-5 w-5 mr-1" /> Change
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {editing ? (
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="text-center text-black font-medium"
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-[#FFBB94] drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
                    {displayName || user?.email?.split("@")[0]}
                  </h2>
                )}
                <p className="text-pink-200">{user?.email}</p>

                <div className="flex justify-center gap-3 mt-4">
                  {editing ? (
                    <Button
                      onClick={handleSave}
                      className="bg-[#DC586D] hover:bg-[#A33757] text-white font-semibold shadow-lg shadow-pink-900/40 transition-all"
                    >
                      Save Changes
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setEditing(true)}
                      className="bg-[#852E4E] hover:bg-[#A33757] text-white font-semibold shadow-lg shadow-pink-900/40 transition-all"
                    >
                      Edit Profile
                    </Button>
                  )}

                  <Button
                    onClick={signOutUser}
                    className="bg-[#4C1D3D] hover:bg-[#852E4E] text-[#FFBB94] border border-pink-600/40 font-semibold shadow-md shadow-pink-900/40 transition-all"
                  >
                    <LogOut className="h-4 w-4 mr-1" /> Logout
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Right: Stats + streaks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 shadow-xl shadow-pink-900/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#FFBB94]">
                  <Sparkles className="h-5 w-5 text-[#FB9590]" />
                  Learning Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-pink-200 mb-1">Study Streak</p>
                  <Progress value={75} className="bg-[#852E4E]" />
                  <p className="text-xs mt-1 text-pink-300">5 days in a row 🌙</p>
                </div>
                <div>
                  <p className="text-sm text-pink-200 mb-1">Flashcards Created</p>
                  <p className="text-[#FFBB94] text-xl font-bold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                    126
                  </p>
                </div>
                <div>
                  <p className="text-sm text-pink-200 mb-1">Quizzes Completed</p>
                  <p className="text-[#FFBB94] text-xl font-bold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                    32
                  </p>
                </div>
                <div>
                  <p className="text-sm text-pink-200 mb-1">AI Prompts Used</p>
                  <p className="text-[#FFBB94] text-xl font-bold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                    58
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
