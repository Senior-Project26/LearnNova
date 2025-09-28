import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Study = () => {
  return (
    <div className="container mx-auto px-4 pt-24 pb-12">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Start Studying</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Upload notes, generate flashcards, and practice quizzes powered by AI.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Upload a PDF</li>
                <li>Generate Flashcards</li>
                <li>Start a Quiz</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Study;
