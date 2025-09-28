import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Profile = () => {
  return (
    <div className="container mx-auto px-4 pt-24 pb-12">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Manage your name, email, and avatar.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">OAuth and integrations coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
