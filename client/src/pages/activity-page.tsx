import { useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useActivityLog } from "@/hooks/use-activity-log";
import { format } from "date-fns";
import {
  Clock,
  Shield,
  FileText,
  User,
  UserCheck,
  LogIn,
  Settings,
  AlertTriangle,
  Loader2,
  Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ActivityPage() {
  const { activityLogs, isLoading, error } = useActivityLog();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Filter activity logs based on search query and selected category
  const filteredLogs = activityLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === "all") return matchesSearch;
    
    const categories = {
      entry: ["entry_created", "entry_updated", "entry_deleted", "entry_shared"],
      auth: ["login_success", "login_failed", "logout", "password_changed", "2fa_enabled", "2fa_disabled"],
      contacts: ["contact_added", "contact_updated", "contact_deleted", "contact_invite_sent", "contact_invite_accepted"],
      security: ["security_alert", "security_settings_changed", "emergency_access_requested", "emergency_access_granted", "emergency_access_denied"],
    };
    
    return matchesSearch && categories[selectedCategory as keyof typeof categories]?.includes(log.action);
  });

  const getActionIcon = (action: string) => {
    if (action.startsWith("entry_")) {
      return <FileText className="h-5 w-5 text-blue-400" />;
    } else if (action.startsWith("login_") || action === "logout") {
      return <LogIn className="h-5 w-5 text-indigo-400" />;
    } else if (action.startsWith("contact_")) {
      return <UserCheck className="h-5 w-5 text-green-400" />;
    } else if (action.startsWith("security_")) {
      return <Shield className="h-5 w-5 text-red-400" />;
    } else if (action.startsWith("emergency_")) {
      return <AlertTriangle className="h-5 w-5 text-orange-400" />;
    } else {
      return <Settings className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <MobileNav />
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Activity Log</h1>
              <p className="text-gray-400 mt-1">Track all actions and events in your account</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search activities..."
                  className="pl-8 bg-primary/40"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[180px] bg-primary/40">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="entry">Vault Entries</SelectItem>
                  <SelectItem value="auth">Authentication</SelectItem>
                  <SelectItem value="contacts">Trusted Contacts</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="bg-primary/40 border-0 shadow-neumorphic">
            <CardHeader>
              <CardTitle className="text-white">Recent Activity</CardTitle>
              <CardDescription>
                Your most recent actions and security events are displayed here
              </CardDescription>
            </CardHeader>
            <Separator className="bg-[#1E293B]" />
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-secondary" />
                </div>
              ) : error ? (
                <div className="text-center p-8 text-red-400">
                  <AlertTriangle className="mx-auto h-12 w-12 mb-2" />
                  <p>Failed to load activity logs. Please try again later.</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center p-8 text-gray-400">
                  <Clock className="mx-auto h-12 w-12 mb-2" />
                  <p>No activity logs found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <ul className="divide-y divide-[#1E293B]">
                    {filteredLogs.map((log) => (
                      <li key={log.id} className="p-4 hover:bg-primary/60 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 p-2 rounded-full bg-secondary/10">
                            {getActionIcon(log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className="font-medium text-white truncate">
                                {log.action.split("_").map(word => 
                                  word.charAt(0).toUpperCase() + word.slice(1)
                                ).join(" ")}
                              </p>
                              <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                                {format(new Date(log.timestamp), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">{log.details}</p>
                            {log.ipAddress && (
                              <div className="flex text-xs text-gray-500 mt-2">
                                <span className="mr-3">IP: {log.ipAddress}</span>
                                {log.deviceInfo && <span>{log.deviceInfo}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}