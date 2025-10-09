import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Sparkles, Upload, LogOut } from "lucide-react";
import { auth, storage } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEffect } from "react";

const Profile = () => {
  const { user, signOutUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [editing, setEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.photoURL || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Simple local state for profile info and preferences (no backend yet)
  const [bio, setBio] = useState("");
  const [theme, setTheme] = useState("space"); // light | dark | space
  const [accent, setAccent] = useState("pink"); // pink | violet | blue
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(false);
  const [notifStudy, setNotifStudy] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("learnnova_profile_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.bio === "string") setBio(parsed.bio);
        if (typeof parsed.theme === "string") setTheme(parsed.theme);
        if (typeof parsed.accent === "string") setAccent(parsed.accent);
        if (typeof parsed.notifEmail === "boolean") setNotifEmail(parsed.notifEmail);
        if (typeof parsed.notifPush === "boolean") setNotifPush(parsed.notifPush);
        if (typeof parsed.notifStudy === "boolean") setNotifStudy(parsed.notifStudy);
      }
    } catch (e) {
      console.debug("Failed to load profile settings from localStorage", e);
    }
  }, []);

  const persistLocalSettings = () => {
    try {
      localStorage.setItem(
        "learnnova_profile_settings",
        JSON.stringify({ bio, theme, accent, notifEmail, notifPush, notifStudy })
      );
    } catch (e) {
      console.debug("Failed to save profile settings to localStorage", e);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic guard: limit to ~5MB
      if (file.size > 5 * 1024 * 1024) {
        alert("Please choose an image under 5MB for faster upload.");
        return;
      }
      setAvatarFile(file);
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      let photoURL = user.photoURL || undefined;
      if (avatarFile) {
        // Compress image on the client to speed up upload
        const compressed = await compressImage(avatarFile, 768, 0.82);
        const safeName = avatarFile.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
        const objectPath = `avatars/${user.uid}/${Date.now()}_${safeName.replace(/\.(png|jpg|jpeg|webp)$/i, "")}.jpg`;
        const storageRef = ref(storage, objectPath);
        const task = uploadBytesResumable(storageRef, compressed, { contentType: "image/jpeg" });
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              if (snap.totalBytes > 0) {
                setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
              }
            },
            (err) => reject(err),
            () => resolve()
          );
        });
        photoURL = await getDownloadURL(task.snapshot.ref);
      }

      await updateProfile(auth.currentUser!, {
        displayName: displayName || user.displayName || undefined,
        photoURL,
      });

      // Clear transient state and exit edit mode
      setAvatarFile(null);
      setEditing(false);

      // Persist local-only settings (bio/preferences)
      persistLocalSettings();
    } catch (err) {
      console.error("Failed to save profile:", err);
      // Optional: surface an error toast here if you have a toaster
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  // Util: compress an image using a canvas to speed up uploads
  async function compressImage(file: File, maxDim = 768, quality = 0.82): Promise<Blob> {
    const imgUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = (e) => rej(e);
        i.src = imgUrl;
      });
      const { width, height } = img;
      const ratio = Math.min(1, maxDim / Math.max(width, height));
      const targetW = Math.max(1, Math.round(width * ratio));
      const targetH = Math.max(1, Math.round(height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const blob: Blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b || file), "image/jpeg", quality);
      });
      return blob;
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12">
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
                {saving && uploadProgress !== null && (
                  <div className="mt-2">
                    <Progress value={uploadProgress} className="bg-[#852E4E]" />
                    <p className="text-xs text-pink-200 mt-1">Uploading {uploadProgress}%</p>
                  </div>
                )}

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

                {/* Bio */}
                <div className="mt-3 text-left">
                  <Label className="text-pink-200 text-sm">About me</Label>
                  <Textarea
                    placeholder="Write a short bio..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="mt-1 text-black"
                    rows={3}
                  />
                </div>

                <div className="flex justify-center gap-3 mt-4">
                  {editing ? (
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-[#DC586D] hover:bg-[#A33757] disabled:opacity-60 text-white font-semibold shadow-lg shadow-pink-900/40 transition-all"
                    >
                      {saving ? "Saving..." : "Save Changes"}
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

                {/* Account actions */}
                <div className="flex justify-center gap-3 mt-3">
                  <Button
                    variant="destructive"
                    disabled
                    className="opacity-60"
                    title="Coming soon"
                  >
                    Delete Account
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Right: Tabs - Profile Info, Preferences, Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 shadow-xl shadow-pink-900/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#FFBB94]">
                  <Sparkles className="h-5 w-5 text-[#FB9590]" />
                  Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="grid grid-cols-3 bg-[#852E4E]/50">
                    <TabsTrigger value="info">Profile Info</TabsTrigger>
                    <TabsTrigger value="prefs">Preferences</TabsTrigger>
                    <TabsTrigger value="progress">Progress</TabsTrigger>
                  </TabsList>

                  {/* Profile Info Tab */}
                  <TabsContent value="info" className="mt-4">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label className="text-pink-200">Display Name</Label>
                        <Input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="text-black"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-pink-200">Email</Label>
                        <Input value={user?.email || ""} disabled className="opacity-80" />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-pink-200">About me</Label>
                        <Textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Short description..."
                          className="text-black"
                          rows={4}
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button onClick={handleSave} disabled={saving} className="bg-[#DC586D] hover:bg-[#A33757]">
                          {saving ? "Saving..." : "Save Info"}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Preferences Tab */}
                  <TabsContent value="prefs" className="mt-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="grid gap-2">
                        <Label className="text-pink-200">Theme</Label>
                        <Select value={theme} onValueChange={(v) => setTheme(v)}>
                          <SelectTrigger className="text-black">
                            <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="space">Space</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-pink-200">Accent Color</Label>
                        <Select value={accent} onValueChange={(v) => setAccent(v)}>
                          <SelectTrigger className="text-black">
                            <SelectValue placeholder="Select accent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pink">Pink</SelectItem>
                            <SelectItem value="violet">Violet</SelectItem>
                            <SelectItem value="blue">Blue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Email Notifications</p>
                          <p className="text-pink-200 text-sm">Updates and activity summaries</p>
                        </div>
                        <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Push Notifications</p>
                          <p className="text-pink-200 text-sm">Real-time reminders</p>
                        </div>
                        <Switch checked={notifPush} onCheckedChange={setNotifPush} />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30 md:col-span-2">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Study Reminders</p>
                          <p className="text-pink-200 text-sm">Daily streak nudges and tips</p>
                        </div>
                        <Switch checked={notifStudy} onCheckedChange={setNotifStudy} />
                      </div>
                      <div className="md:col-span-2">
                        <Button onClick={persistLocalSettings} className="bg-[#DC586D] hover:bg-[#A33757]">
                          Save Preferences
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Progress Tab */}
                  <TabsContent value="progress" className="mt-4">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                        <CardHeader>
                          <CardTitle className="text-[#FFBB94] text-base">Study Streak</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Progress value={75} className="bg-[#852E4E]" />
                          <p className="text-pink-200 text-sm mt-2">5 days in a row 🌙</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                        <CardHeader>
                          <CardTitle className="text-[#FFBB94] text-base">Flashcards Done</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-[#FFBB94] text-3xl font-bold">126</p>
                          <p className="text-pink-200 text-sm">+12 this week</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                        <CardHeader>
                          <CardTitle className="text-[#FFBB94] text-base">Quizzes Completed</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-[#FFBB94] text-3xl font-bold">32</p>
                          <p className="text-pink-200 text-sm">Avg. score: 86%</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                        <CardHeader>
                          <CardTitle className="text-[#FFBB94] text-base">Favorite Subjects</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 rounded-full bg-[#852E4E] text-[#FFBB94] text-xs">Algebra</span>
                            <span className="px-2 py-1 rounded-full bg-[#852E4E] text-[#FFBB94] text-xs">Biology</span>
                            <span className="px-2 py-1 rounded-full bg-[#852E4E] text-[#FFBB94] text-xs">World History</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
