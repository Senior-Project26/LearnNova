import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type PlanResultLocationState = {
  courseName?: string;
  studyGuideTitle?: string;
  quizTitle?: string;
  studyGuideId?: number;
  quizId?: number;
};

export default function PlanResult() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: PlanResultLocationState };
  const courseName = location.state?.courseName || "this course";
  const studyGuideTitle = location.state?.studyGuideTitle || `${courseName} Study Guide`;
  const quizTitle = location.state?.quizTitle || `${courseName} Quiz`;
  const studyGuideId = location.state?.studyGuideId;
  const quizId = location.state?.quizId;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12">
      <div className="relative container mx-auto text-white flex flex-col items-center gap-6 max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
          Study materials generated!
        </h1>
        <p className="text-pink-100 text-sm">
          We created a focused study guide and quiz for your selected topics in {courseName}.
        </p>
        <div className="w-full bg-[#4C1D3D]/70 border border-pink-700/40 rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-pink-300">Study Guide</p>
            <p className="text-sm font-semibold text-[#FFBB94] break-words">{studyGuideTitle}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-pink-300">Quiz</p>
            <p className="text-sm font-semibold text-[#FFBB94] break-words">{quizTitle}</p>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              type="button"
              className="bg-[#FB9590] text-[#2A1023] hover:bg-[#FFBB94] font-semibold px-4 py-2"
              onClick={() => {
                if (typeof studyGuideId === "number") {
                  navigate("/study-guide", { state: { studyGuideId } });
                } else {
                  navigate("/study-guide");
                }
              }}
            >
              Open Study Guide
            </Button>
            <Button
              type="button"
              className="bg-[#852E4E] text-[#FFBB94] hover:bg-[#A33757] font-semibold px-4 py-2"
              onClick={() => {
                if (typeof quizId === "number") {
                  navigate("/quiz", { state: { quizId } });
                } else {
                  navigate("/quiz");
                }
              }}
            >
              Take Quiz
            </Button>
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-pink-200 hover:text-pink-100 underline-offset-2 hover:underline"
            onClick={() => navigate("/study")}
          >
            Back to Study Hub
          </button>
        </div>
      </div>
    </div>
  );
}
