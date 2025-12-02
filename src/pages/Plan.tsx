import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type PlanLocationState = {
  courseName?: string;
  courseId?: number;
};

type TopicScore = {
  topic_id?: number;
  title?: string;
  score?: number;
};

// Helper to title‑case topic names
const toTitleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const Plan = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: PlanLocationState };

  const courseName = location.state?.courseName || "this course";
  const courseId = location.state?.courseId;

  const [lowMasteryTopics, setLowMasteryTopics] = useState<TopicScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTopicKeys, setSelectedTopicKeys] = useState<(number | string)[]>([]);

  const toggleTopicSelected = (t: TopicScore) => {
    const key = t.topic_id ?? t.title ?? "";
    if (!key) return;
    setSelectedTopicKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  useEffect(() => {
    if (!courseId) {
      setLowMasteryTopics([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/course_low_mastery_topics?course_id=${courseId}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          items?: TopicScore[];
        };
        if (!res.ok || !Array.isArray(data.items)) {
          if (!cancelled) setLowMasteryTopics([]);
          return;
        }
        if (!cancelled) setLowMasteryTopics(data.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12">
      <div className="relative container mx-auto text-white flex flex-col items-center gap-8">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
            Create study plan for {courseName}
          </h1>
          <p className="text-pink-100 text-sm">
            Based on your quiz history, we'll focus on topics where your mastery is below 3.5.
          </p>
          <p className="text-pink-100 text-xs mt-1">
            A score of 0 means you have not practiced that topic yet.
          </p>
        </div>

        <div className="w-full max-w-3xl bg-[#4C1D3D]/70 border border-pink-700/40 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-[#FFBB94] text-center">
            Topics to prioritize
          </h2>

          {loading && (
            <p className="text-sm text-pink-200 text-center">Loading topics…</p>
          )}

          {!loading && lowMasteryTopics.length === 0 && (
            <p className="text-sm text-pink-200 text-center">
              Great work! We don't see any topics below 3.5 mastery for this course right now.
            </p>
          )}

          {!loading && lowMasteryTopics.length > 0 && (
            <>
              <div className="space-y-2">
                {lowMasteryTopics.map((t, idx) => {
                  const key = t.topic_id ?? t.title ?? idx;
                  const selected = selectedTopicKeys.includes(key);
                  const rawTitle = t.title || "Untitled topic";
                  const displayTitle = toTitleCase(rawTitle);

                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => toggleTopicSelected(t)}
                      className="w-full flex items-center justify-between rounded-lg bg-[#852E4E]/50 border border-pink-700/50 px-3 py-2 text-sm hover:bg-[#A33757]/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {/* selector circle */}
                        <div
                          className={
                            "h-4 w-4 rounded-full border border-pink-200 flex items-center justify-center " +
                            (selected ? "bg-[#FFBB94]" : "bg-transparent")
                          }
                        >
                          {selected && (
                            <div className="h-2 w-2 rounded-full bg-[#4C1D3D]" />
                          )}
                        </div>
                        <span className="text-pink-50">{displayTitle}</span>
                      </div>
                      <span className="text-pink-200 text-xs">
                        score: {typeof t.score === "number" ? t.score.toFixed(2) : "0.00"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  disabled={selectedTopicKeys.length === 0}
                  className={
                    "px-4 py-2 rounded-lg text-sm font-semibold transition-colors " +
                    (selectedTopicKeys.length === 0
                      ? "bg-pink-900/40 text-pink-300 cursor-not-allowed"
                      : "bg-[#FFBB94] text-[#4C1D3D] hover:bg-[#FFC8A8]")
                  }
                  onClick={async () => {
                    if (selectedTopicKeys.length === 0) return;
                    const topicsPayload = lowMasteryTopics.filter((t, idx) => {
                      const key = t.topic_id ?? t.title ?? idx;
                      return selectedTopicKeys.includes(key);
                    });
                    if (!topicsPayload.length) return;
                    try {
                      const res = await fetch("/api/plan_from_topics", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                          course_id: courseId,
                          course_name: courseName,
                          topics: topicsPayload,
                        }),
                      });
                      const data = (await res.json().catch(() => ({}))) as {
                        study_guide?: { id?: number; title?: string };
                        quiz?: { id?: number; title?: string };
                        error?: string;
                      };
                      if (!res.ok || data?.error) {
                        // For now, just bail; a future enhancement could surface a toast.
                        return;
                      }
                      const sg = data.study_guide || {};
                      const qz = data.quiz || {};
                      navigate("/plan/results", {
                        state: {
                          courseName,
                          studyGuideTitle: sg.title || `${courseName} Study Guide`,
                          studyGuideId: typeof sg.id === "number" ? sg.id : undefined,
                          quizTitle: qz.title || `${courseName} Quiz`,
                          quizId: typeof qz.id === "number" ? qz.id : undefined,
                        },
                      });
                    } catch {
                      // Silent failure; keep user on the same page.
                    }
                  }}
                >
                  Create Plan
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Plan;