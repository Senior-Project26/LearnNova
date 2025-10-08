import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  BookOpen,
  FileUp,
  Brain,
  Sparkles,
  Trash2,
  Plus,
  FolderOpen,
  PenTool,
} from "lucide-react";

const Study = () => {
  // ---- STATE ----
  const navigate = useNavigate();
  const [studySets, setStudySets] = useState([
    {
      id: 1,
      name: "Biology 101",
      cards: 25,
      progress: 70,
      flashcards: [
        { q: "What is the powerhouse of the cell?", a: "Mitochondria" },
        { q: "What carries genetic information?", a: "DNA" },
      ],
    },
    {
      id: 2,
      name: "Calculus Review",
      cards: 18,
      progress: 40,
      flashcards: [
        { q: "Derivative of sin(x)?", a: "cos(x)" },
        { q: "Integral of 2x?", a: "x² + C" },
      ],
    },
  ]);
  const [newSetName, setNewSetName] = useState("");
  const [selectedSet, setSelectedSet] = useState<number | null>(null);

  // ---- HANDLERS ----
  const addSet = () => {
    if (!newSetName.trim()) return;
    const newSet = {
      id: Date.now(),
      name: newSetName,
      cards: 0,
      progress: 0,
      flashcards: [],
    };
    setStudySets([...studySets, newSet]);
    setNewSetName("");
  };

  const removeSet = (id: number) => {
    setStudySets(studySets.filter((set) => set.id !== id));
    if (selectedSet === id) setSelectedSet(null);
  };

  const toggleSetView = (id: number) => {
    setSelectedSet(selectedSet === id ? null : id);
  };

  // ---- COMPUTED PROGRESS ----
  const totalProgress =
    studySets.length > 0
      ? Math.round(
          studySets.reduce((sum, s) => sum + s.progress, 0) / studySets.length
        )
      : 0;

  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12"
      style={{
        background:
          "radial-gradient(circle at top left, #4C1D3D 0%, #852E4E 40%, #A33757 70%, #DC586D 90%)",
      }}
    >
      {/* Glow overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(255,187,148,0.1),transparent_70%)] blur-3xl"></div>

      <div className="relative container mx-auto space-y-8 text-white">
        {/* --- Header --- */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
            Your Study Hub
          </h1>
          <p className="text-pink-100">
            Manage your notes, flashcards, and quizzes — powered by LearnNova AI ✨
          </p>
        </div>

        {/* --- Main Grid --- */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* --- Left Column --- */}
          <div className="md:col-span-2 space-y-6">
            {/* Progress Tracker */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-[#FB9590]" /> Study Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Total Progress</span>
                  <span>{totalProgress}%</span>
                </div>
                <Progress value={totalProgress} className="bg-[#852E4E]" />
              </CardContent>
            </Card>

            {/* Study Sets */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader className="flex justify-between items-center">
                <CardTitle>Your Study Sets</CardTitle>
                <div className="flex gap-2">
                  <Input
                    placeholder="New set name"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    className="w-40 text-black"
                  />
                  <Button onClick={addSet} className="bg-[#852E4E] hover:bg-[#A33757] text-white">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {studySets.map((set) => (
                  <div
                    key={set.id}
                    onClick={() => toggleSetView(set.id)}
                    className="p-4 rounded-lg bg-[#852E4E]/40 hover:bg-[#A33757]/50 transition cursor-pointer shadow-md shadow-pink-900/20"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-[#FFBB94]">{set.name}</h3>
                        <p className="text-sm text-pink-200">{set.cards} flashcards</p>
                      </div>
                      <Progress
                        value={set.progress}
                        className="w-24 h-2 bg-[#4C1D3D] text-[#FFBB94]"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSet(set.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-pink-300 hover:text-[#FFBB94]" />
                      </Button>
                    </div>

                    {/* Expanded view */}
                    {selectedSet === set.id && (
                      <div className="mt-3 p-3 bg-[#4C1D3D]/70 rounded-lg border border-pink-700/30">
                        <p className="text-pink-100 mb-2 font-semibold">Flashcards:</p>
                        {set.flashcards.length > 0 ? (
                          <ul className="list-disc pl-5 space-y-1 text-sm text-pink-200">
                            {set.flashcards.map((fc, i) => (
                              <li key={i}>
                                <span className="text-[#FFBB94]">{fc.q}</span> — {fc.a}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-pink-300 italic">No flashcards yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* --- Right Column --- */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#FB9590]" /> Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { icon: <PenTool className="h-4 w-4 mr-2" />, label: "Create New Flashcards" },
                  { icon: <Sparkles className="h-4 w-4 mr-2" />, label: "Generate Flashcards (AI)" },
                  { icon: <Brain className="h-4 w-4 mr-2" />, label: "Generate Quiz", navigateTo: "/quiz" },
                  { icon: <FileUp className="h-4 w-4 mr-2" />, label: "Upload Notes or Book excerpts", navigateTo: "/upload" },
                  { icon: <FolderOpen className="h-4 w-4 mr-2" />, label: "Make Custom Quiz" },
                ].map((action, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start text-[#FFBB94] hover:bg-[#852E4E]/50 hover:text-[#FFBB94] transition-all font-medium"
                    onClick={() => {
                      if ((action as any).navigateTo) {
                        navigate((action as any).navigateTo);
                      }
                    }}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Daily Tip */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle>Today’s Study Tip</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="italic text-pink-200">
                  “Study smarter, not longer — 25 minutes of focus beats 2 hours of distraction.” 🌙
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Study;
