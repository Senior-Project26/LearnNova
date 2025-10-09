import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Shield, Bell, Cog, UserCog, Brain, Link2, Download } from "lucide-react";

type SettingsShape = {
  privacy: {
    showProfile: boolean;
    shareNotes: boolean;
    shareDecks: boolean;
  };
  ai: {
    personalized: boolean;
    useHistory: boolean;
  };
  notifications: {
    quizReminders: boolean;
    streak: boolean;
    studyTips: boolean;
  };
  system: {
    language: string;
    timeZone: string;
    dateFormat: string;
  };
};

const DEFAULTS: SettingsShape = {
  privacy: { showProfile: true, shareNotes: false, shareDecks: false },
  ai: { personalized: true, useHistory: true },
  notifications: { quizReminders: true, streak: true, studyTips: true },
  system: { language: "en-US", timeZone: "UTC", dateFormat: "MM/DD/YYYY" },
};

const STORAGE_KEY = "learnnova_settings";

const Settings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsShape>(DEFAULTS);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({ ...DEFAULTS, ...parsed });
      } else {
        // infer defaults from system
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        setSettings((s) => ({ ...s, system: { ...s.system, timeZone: tz } }));
      }
    } catch (e) {
      console.debug("Failed to load settings", e);
    }
  }, []);

  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.debug("Failed to save settings", e);
    }
  };

  const resetAIMemory = () => {
    // Placeholder: clear any local AI keys; real backend hook later
    localStorage.removeItem("learnnova_ai_memory");
    alert("AI memory reset (local placeholder)");
  };

  const lastLogin = useMemo(() => user?.metadata?.lastSignInTime || "–", [user]);
  const providers = useMemo(() => (user?.providerData || []).map((p) => p.providerId), [user]);

  const timeZones = useMemo(
    () => [
      "UTC",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Asia/Kolkata",
      "Australia/Sydney",
    ],
    []
  );

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(255,187,148,0.15),transparent_70%)] blur-3xl" />

      <div className="relative container mx-auto text-white">
        <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 shadow-xl shadow-pink-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl text-[#FFBB94]">
              <Cog className="h-6 w-6 text-[#FB9590]" /> Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="grid grid-cols-5 bg-[#852E4E]/50">
                <TabsTrigger value="account" className="text-sm flex items-center gap-1">
                  <UserCog className="h-4 w-4" /> Account
                </TabsTrigger>
                <TabsTrigger value="privacy" className="text-sm flex items-center gap-1">
                  <Shield className="h-4 w-4" /> Privacy
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-sm flex items-center gap-1">
                  <Brain className="h-4 w-4" /> AI
                </TabsTrigger>
                <TabsTrigger value="notify" className="text-sm flex items-center gap-1">
                  <Bell className="h-4 w-4" /> Notifications
                </TabsTrigger>
                <TabsTrigger value="system" className="text-sm flex items-center gap-1">
                  <Cog className="h-4 w-4" /> System
                </TabsTrigger>
              </TabsList>

              {/* Account Settings */}
              <TabsContent value="account" className="mt-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                    <CardHeader>
                      <CardTitle className="text-[#FFBB94]">Change Password</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Label className="text-pink-200">Current Password</Label>
                      <Input type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} className="text-black" />
                      <Label className="text-pink-200">New Password</Label>
                      <Input type="password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} className="text-black" />
                      <Label className="text-pink-200">Confirm New Password</Label>
                      <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} className="text-black" />
                      <div className="pt-2">
                        <Button onClick={() => alert("Password change coming soon")} className="bg-[#DC586D] hover:bg-[#A33757]">Update Password</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                    <CardHeader>
                      <CardTitle className="text-[#FFBB94]">Linked Accounts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-[#FB9590]" /> Google
                        </div>
                        <span className="text-sm text-pink-200">{providers.includes("google.com") ? "Connected" : "Not connected"}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-[#FB9590]" /> Email/Password
                        </div>
                        <span className="text-sm text-pink-200">{providers.includes("password") ? "Connected" : "Not connected"}</span>
                      </div>
                      <div className="pt-2">
                        <Button variant="outline" className="border-pink-600/40 text-[#FFBB94] bg-transparent hover:bg-[#852E4E]/50" onClick={() => alert("Manage linked accounts coming soon")}>Manage</Button>
                      </div>
                      <Separator className="my-2 bg-pink-900/40" />
                      <p className="text-xs text-pink-300">Last login: {lastLogin}</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Privacy & Security */}
              <TabsContent value="privacy" className="mt-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                    <CardHeader>
                      <CardTitle className="text-[#FFBB94]">Profile & Data Visibility</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Show my profile to others</p>
                          <p className="text-pink-200 text-sm">Allow others to view basic profile</p>
                        </div>
                        <Switch
                          checked={settings.privacy.showProfile}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, privacy: { ...s.privacy, showProfile: v } }))}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Share my notes</p>
                          <p className="text-pink-200 text-sm">Make created notes discoverable</p>
                        </div>
                        <Switch
                          checked={settings.privacy.shareNotes}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, privacy: { ...s.privacy, shareNotes: v } }))}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Share my decks</p>
                          <p className="text-pink-200 text-sm">Allow others to see shared decks</p>
                        </div>
                        <Switch
                          checked={settings.privacy.shareDecks}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, privacy: { ...s.privacy, shareDecks: v } }))}
                        />
                      </div>
                      <div className="pt-2 flex gap-3">
                        <Button onClick={saveSettings} className="bg-[#DC586D] hover:bg-[#A33757]">Save Privacy</Button>
                        <Button
                          variant="outline"
                          className="border-pink-600/40 text-[#FFBB94] bg-transparent hover:bg-[#852E4E]/50"
                          onClick={() => alert("Download request queued (placeholder)")}
                        >
                          <Download className="h-4 w-4 mr-1" /> Download My Data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* AI Settings */}
              <TabsContent value="ai" className="mt-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                    <CardHeader>
                      <CardTitle className="text-[#FFBB94]">AI Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Personalized recommendations</p>
                          <p className="text-pink-200 text-sm">Tailor content based on your activity</p>
                        </div>
                        <Switch
                          checked={settings.ai.personalized}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, ai: { ...s.ai, personalized: v } }))}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Allow AI to use study history</p>
                          <p className="text-pink-200 text-sm">Improve suggestions using past sessions</p>
                        </div>
                        <Switch
                          checked={settings.ai.useHistory}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, ai: { ...s.ai, useHistory: v } }))}
                        />
                      </div>
                      <div className="pt-2 flex gap-3">
                        <Button onClick={saveSettings} className="bg-[#DC586D] hover:bg-[#A33757]">Save AI Settings</Button>
                        <Button variant="outline" className="border-pink-600/40 text-[#FFBB94] bg-transparent hover:bg-[#852E4E]/50" onClick={resetAIMemory}>Reset AI Memory</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notify" className="mt-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                    <CardHeader>
                      <CardTitle className="text-[#FFBB94]">Notification Preferences</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Quiz reminders</p>
                          <p className="text-pink-200 text-sm">Get nudges to practice</p>
                        </div>
                        <Switch
                          checked={settings.notifications.quizReminders}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, quizReminders: v } }))}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Streak notifications</p>
                          <p className="text-pink-200 text-sm">Keep your streak alive</p>
                        </div>
                        <Switch
                          checked={settings.notifications.streak}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, streak: v } }))}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#4C1D3D]/60 border border-pink-700/30">
                        <div>
                          <p className="text-[#FFBB94] font-medium">Study tips</p>
                          <p className="text-pink-200 text-sm">Weekly tips and insights</p>
                        </div>
                        <Switch
                          checked={settings.notifications.studyTips}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, studyTips: v } }))}
                        />
                      </div>
                      <div className="pt-2">
                        <Button onClick={saveSettings} className="bg-[#DC586D] hover:bg-[#A33757]">Save Notifications</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* System Settings */}
              <TabsContent value="system" className="mt-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="bg-[#4C1D3D]/60 border-pink-700/30">
                    <CardHeader>
                      <CardTitle className="text-[#FFBB94]">System Preferences</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="grid gap-2">
                        <Label className="text-pink-200">Language</Label>
                        <Select value={settings.system.language} onValueChange={(v) => setSettings((s) => ({ ...s, system: { ...s.system, language: v } }))}>
                          <SelectTrigger className="text-black">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en-US">English (US)</SelectItem>
                            <SelectItem value="en-GB">English (UK)</SelectItem>
                            <SelectItem value="es-ES">Español (ES)</SelectItem>
                            <SelectItem value="fr-FR">Français (FR)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-pink-200">Time Zone</Label>
                        <Select value={settings.system.timeZone} onValueChange={(v) => setSettings((s) => ({ ...s, system: { ...s.system, timeZone: v } }))}>
                          <SelectTrigger className="text-black">
                            <SelectValue placeholder="Select time zone" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeZones.map((tz) => (
                              <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-pink-200">Date Format</Label>
                        <Select value={settings.system.dateFormat} onValueChange={(v) => setSettings((s) => ({ ...s, system: { ...s.system, dateFormat: v } }))}>
                          <SelectTrigger className="text-black">
                            <SelectValue placeholder="Select date format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Button onClick={saveSettings} className="bg-[#DC586D] hover:bg-[#A33757]">Save System Settings</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
