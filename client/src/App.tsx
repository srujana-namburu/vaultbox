import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import VaultEntries from "@/pages/vault-entries";
import EntryDetail from "@/pages/entry-detail";
import NewEntry from "@/pages/new-entry";
import AboutPage from "@/pages/about-page";
import TrustedContactPage from "@/pages/trusted-contact-page";
import EmergencyRequestPage from "@/pages/emergency-request-page";
import EmergencyAccessPage from "@/pages/emergency-access-page";
import NotificationsPage from "@/pages/notifications-page";
import NotificationSettings from "@/pages/notification-settings";
import ActivityPage from "@/pages/activity-page";
import SettingsPage from "@/pages/settings-page";
import { ProtectedRoute } from "@/lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { NotificationProvider } from "@/hooks/use-notifications";
import { ActivityLogProvider } from "@/hooks/use-activity-log";
import TrustedUserPage from "@/pages/trusted-user-page"; // Assuming this import is needed

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/emergency-request" component={EmergencyRequestPage} />
      <Route path="/emergency-access" component={EmergencyAccessPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/vault" component={VaultEntries} />
      <ProtectedRoute path="/entry/:id" component={EntryDetail} />
      <ProtectedRoute path="/new-entry" component={NewEntry} />
      <ProtectedRoute path="/trusted-contacts" component={TrustedContactPage} />
      <ProtectedRoute path="/notifications" component={NotificationsPage} />
      <ProtectedRoute path="/notification-settings" component={NotificationSettings} />
      <ProtectedRoute path="/activity" component={ActivityPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/about" component={AboutPage} />
      <Route path="/trusted-user" component={TrustedUserPage} /> {/* Added route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <ActivityLogProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </ActivityLogProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;