import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard = () => {
  return (
    <div className="container mx-auto px-4 pt-24 pb-12">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-2xl">Your Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Charts and recent activity will appear here.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Sets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Quick access to your latest study sets.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
