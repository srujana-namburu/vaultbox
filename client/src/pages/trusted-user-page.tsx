import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function TrustedUserPage() {
  const { user } = useAuth();

  const { data: trustedAccounts, isLoading } = useQuery({
    queryKey: ['trusted-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/trusted-accounts/as-contact');
      if (!res.ok) throw new Error('Failed to fetch trusted accounts');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <MobileNav />
          <div className="p-4 lg:p-8">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-col space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Trusted User Dashboard</h1>
                <p className="text-muted-foreground">
                  View and manage accounts where you serve as a trusted contact.
                </p>
              </div>

              <div className="grid gap-6">
                {trustedAccounts?.length > 0 ? (
                  trustedAccounts.map((account: any) => (
                    <Card key={account.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{account.ownerName}</CardTitle>
                            <CardDescription>{account.ownerEmail}</CardDescription>
                          </div>
                          <Badge variant={account.status === 'active' ? 'default' : 'outline'}>
                            {account.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">Inactivity Period</span>
                              <span className="text-sm text-muted-foreground">
                                {account.daysSinceLastActivity} / {account.inactivityThreshold} days
                              </span>
                            </div>
                            <Progress 
                              value={(account.daysSinceLastActivity / account.inactivityThreshold) * 100} 
                            />
                          </div>

                          <div>
                            <h4 className="text-sm font-medium mb-2">Access Level</h4>
                            <Badge variant="secondary">
                              {account.accessLevel}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No Trusted Accounts</h3>
                      <p className="text-sm text-muted-foreground text-center mt-2">
                        You haven't been designated as a trusted contact for any accounts yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}