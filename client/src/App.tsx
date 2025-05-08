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
import { ProtectedRoute } from "@/lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";

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
      <ProtectedRoute path="/about" component={AboutPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
