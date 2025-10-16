import { useLocation, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Brain, BookOpen, Upload, Sparkles, AlertCircle } from "lucide-react";

export default function Summary() {
  const location = useLocation() as { state?: { summary?: string; result?: any } };
  const summary = location.state?.summary;
  const result = location.state?.result;
  const navigate = useNavigate();

  const quizMe = () => {
    if (!summary) return;
    try {
      // Persist summary for Quiz.tsx prefill
      sessionStorage.setItem(
        "lastUploadResult",
        JSON.stringify({ summary })
      );
    } catch {}
    navigate("/quiz");
  };

  const studyGuide = () => {
    if (!summary) return;
    try {
      sessionStorage.setItem(
        "lastUploadResult",
        JSON.stringify({ summary })
      );
    } catch {}
    navigate("/study-guide");
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text mb-2">
            Document Summary
          </h1>
          <p className="text-pink-100 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-[#FB9590]" />
            Your AI-generated summary is ready
          </p>
        </div>

        {!summary ? (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <AlertCircle className="h-16 w-16 mx-auto text-pink-300/30" />
                <div>
                  <p className="text-pink-200 text-lg mb-2">No summary data found</p>
                  <p className="text-pink-300/70 text-sm">Please upload a file first to generate a summary</p>
                </div>
                <Link 
                  to="/upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#DC586D] to-[#A33757] text-white rounded-xl font-medium shadow-lg hover:shadow-pink-900/30 transition-all hover:scale-[1.02]"
                >
                  <Upload className="h-5 w-5" />
                  Go to Upload
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary Card */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                    <FileText className="h-5 w-5 text-[#FB9590]" />
                  </div>
                  <span className="text-pink-100">Summary Content</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#852E4E]/20 p-6 rounded-lg border border-pink-700/30">
                  <pre className="whitespace-pre-wrap text-pink-100 text-sm leading-relaxed">{summary}</pre>
                </div>
                {result && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-pink-300/70 text-sm hover:text-pink-200 transition-colors">
                      View raw response
                    </summary>
                    <div className="mt-3 bg-[#852E4E]/20 p-4 rounded-lg border border-pink-700/30">
                      <pre className="whitespace-pre-wrap text-pink-200 text-xs">{JSON.stringify(result, null, 2)}</pre>
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="text-pink-100">Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <button 
                    onClick={quizMe}
                    className="flex items-center justify-center gap-3 p-4 bg-[#852E4E]/40 hover:bg-[#852E4E]/60 border border-pink-700/40 rounded-xl transition-all hover:shadow-lg hover:shadow-pink-900/20 group"
                  >
                    <Brain className="h-6 w-6 text-[#FFBB94] group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <div className="font-semibold text-pink-100">Quiz Me!</div>
                      <div className="text-xs text-pink-300/70">Test your knowledge</div>
                    </div>
                  </button>
                  <button 
                    onClick={studyGuide}
                    className="flex items-center justify-center gap-3 p-4 bg-[#852E4E]/40 hover:bg-[#852E4E]/60 border border-pink-700/40 rounded-xl transition-all hover:shadow-lg hover:shadow-pink-900/20 group"
                  >
                    <BookOpen className="h-6 w-6 text-[#FFBB94] group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <div className="font-semibold text-pink-100">Study Guide</div>
                      <div className="text-xs text-pink-300/70">Create a guide</div>
                    </div>
                  </button>
                </div>
                <Link 
                  to="/upload"
                  className="mt-4 flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-[#DC586D] to-[#A33757] text-white rounded-xl font-medium shadow-lg hover:shadow-pink-900/30 transition-all hover:scale-[1.02]"
                >
                  <Upload className="h-5 w-5" />
                  Upload Another File
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
