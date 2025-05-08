import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { ActivityItem } from "@/components/ui/activity-item";
import { TrustedContactItem } from "@/components/ui/trusted-contact-item";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { ActivityLog, TrustedContact, VaultEntry } from "@shared/schema";
import { 
  Tickets, 
  CreditCard, 
  Key, 
  HeartPulse,
  AlertCircle
} from "lucide-react";
import { useState } from "react";

export default function HomePage() {
  const { user, formatLastLogin } = useAuth();
  const [securityOpen, setSecurityOpen] = useState(false);
  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "Never";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleString();
    } catch {
      return "Invalid date";
    }
  };
  const [location] = useLocation();
  
  // Fetch vault entries
  const { 
    data: vaultEntries,
    isLoading: entriesLoading 
  } = useQuery<VaultEntry[]>({
    queryKey: ["/api/vault-entries"],
  });
  
  // Fetch activity logs
  const { 
    data: activityLogs,
    isLoading: logsLoading 
  } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
  });
  
  // Fetch trusted contacts
  const { 
    data: trustedContacts,
    isLoading: contactsLoading 
  } = useQuery<TrustedContact[]>({
    queryKey: ["/api/trusted-contacts"],
  });
  
  // Count entries by category
  const getEntriesCount = (category: string) => {
    if (!vaultEntries) return 0;
    return vaultEntries.filter(entry => entry.category === category).length;
  };
  
  // Security score
  const securityScore = user?.securityScore || 65;
  
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <MobileNav />
          <div className="p-4 lg:p-8">
            {/* Header */}
            <div className="lg:flex lg:justify-between lg:items-center mb-6">
              <div>
                <h2 className="font-montserrat font-bold text-2xl text-white">
                  Welcome Back, {user?.fullName?.split(' ')[0]}
                </h2>
                <p className="text-[#E5E5E5]">
                  Last login: {formatLastLogin(user?.lastLogin)}
                </p>
              </div>
              <div className="mt-4 lg:mt-0">
                <Link href="/new-entry">
                  <Button className="bg-secondary hover:bg-secondary/90 text-white shadow-neumorphic hover:shadow-glow transition-all duration-300">
                    <Plus className="mr-2 h-4 w-4" />
                    New Entry
                  </Button>
                </Link>
              </div>
            </div>
            {/* Security Status Card - entire card is clickable for dropdown */}
            <div
              className={`mb-8 bg-primary/40 rounded-xl p-6 shadow-neumorphic cursor-pointer transition-all duration-300 hover:shadow-glow-strong ${securityOpen ? 'ring-2 ring-secondary/40' : ''}`}
              onClick={() => setSecurityOpen((v) => !v)}
              aria-expanded={securityOpen}
            >
              <div className="flex flex-col lg:flex-row lg:items-center">
                <div className="flex-1">
                  <h3 className="font-montserrat font-medium text-xl text-white mb-1">Security Status</h3>
                  <p className="text-[#E5E5E5] mb-3">
                    Your account security is 
                    <span className={`font-medium ${
                      securityScore >= 80 ? "text-secondary" :
                      securityScore >= 60 ? "text-[#F8B400]" :
                      "text-[#F23557]"
                    }`}> {
                      securityScore >= 80 ? "Excellent" :
                      securityScore >= 60 ? "Good" :
                      "Needs Improvement"
                    }</span>
                    {securityScore < 80 && ", but could be improved."}
                  </p>
                  <div className="flex items-center">
                    <div className="h-2 flex-1 bg-[#1E293B] rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          securityScore >= 80 ? "bg-secondary" :
                          securityScore >= 60 ? "bg-[#F8B400]" :
                          "bg-[#F23557]"
                        }`} 
                        style={{ width: `${securityScore}%` }} 
                      />
                    </div>
                    <span className={`ml-3 font-medium ${
                      securityScore >= 80 ? "text-secondary" :
                      securityScore >= 60 ? "text-[#F8B400]" :
                      "text-[#F23557]"
                    }`}>
                      {securityScore}%
                    </span>
                  </div>
                  <div
                    className={`mt-4 overflow-hidden transition-all duration-500 ${securityOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                    style={{ pointerEvents: securityOpen ? 'auto' : 'none' }}
                  >
                    <div className="mt-2 bg-[#1E293B] rounded-lg p-4 text-white shadow-lg space-y-2 animate-fade-in">
                      <div>
                        <span className="font-semibold">2FA Enabled:</span> {user?.twoFactorEnabled ? "Yes" : "No"}
                      </div>
                      <div>
                        <span className="font-semibold">Last Password Change:</span> {formatDate(user?.passwordUpdatedAt)}
                      </div>
                      <div>
                        <span className="font-semibold">Last Failed Login:</span> {formatDate(user?.lastFailedLogin)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Personal documents card */}
              <Link href="/vault?category=personal_documents" className="block">
                <div className="bg-primary/40 rounded-xl p-5 shadow-neumorphic hover:shadow-glow-strong transition-all duration-300 cursor-pointer h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-secondary/20 rounded-lg">
                      <Tickets className="h-5 w-5 text-secondary" />
                    </div>
                    {entriesLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-secondary" />
                    ) : (
                      <span className="text-lg font-medium">{getEntriesCount("personal_documents")}</span>
                    )}
                  </div>
                  <h3 className="font-montserrat font-medium text-white">Personal Documents</h3>
                  <p className="text-sm text-[#E5E5E5] mt-1">Passports, IDs, certificates</p>
                </div>
              </Link>
              
              {/* Financial Records card */}
              <Link href="/vault?category=financial_records" className="block">
                <div className="bg-primary/40 rounded-xl p-5 shadow-neumorphic hover:shadow-glow-strong transition-all duration-300 cursor-pointer h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-secondary/20 rounded-lg">
                      <CreditCard className="h-5 w-5 text-secondary" />
                    </div>
                    {entriesLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-secondary" />
                    ) : (
                      <span className="text-lg font-medium">{getEntriesCount("financial_records")}</span>
                    )}
                  </div>
                  <h3 className="font-montserrat font-medium text-white">Financial Records</h3>
                  <p className="text-sm text-[#E5E5E5] mt-1">Bank accounts, investments</p>
                </div>
              </Link>
              
              {/* Account Credentials card */}
              <Link href="/vault?category=account_credentials" className="block">
                <div className="bg-primary/40 rounded-xl p-5 shadow-neumorphic hover:shadow-glow-strong transition-all duration-300 cursor-pointer h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-secondary/20 rounded-lg">
                      <Key className="h-5 w-5 text-secondary" />
                    </div>
                    {entriesLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-secondary" />
                    ) : (
                      <span className="text-lg font-medium">{getEntriesCount("account_credentials")}</span>
                    )}
                  </div>
                  <h3 className="font-montserrat font-medium text-white">Account Credentials</h3>
                  <p className="text-sm text-[#E5E5E5] mt-1">Passwords, security codes</p>
                </div>
              </Link>
              
              {/* Medical Information card */}
              <Link href="/vault?category=medical_information" className="block">
                <div className="bg-primary/40 rounded-xl p-5 shadow-neumorphic hover:shadow-glow-strong transition-all duration-300 cursor-pointer h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-secondary/20 rounded-lg">
                      <HeartPulse className="h-5 w-5 text-secondary" />
                    </div>
                    {entriesLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-secondary" />
                    ) : (
                      <span className="text-lg font-medium">{getEntriesCount("medical_information")}</span>
                    )}
                  </div>
                  <h3 className="font-montserrat font-medium text-white">Medical Information</h3>
                  <p className="text-sm text-[#E5E5E5] mt-1">Health records, insurance</p>
                </div>
              </Link>
            </div>
            
            {/* Recent Activity & Trusted Contacts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <div className="lg:col-span-2 bg-primary/40 rounded-xl p-6 shadow-neumorphic">
                <h3 className="font-montserrat font-medium text-xl text-white mb-4">Recent Activity</h3>
                
                {logsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-secondary" />
                  </div>
                ) : activityLogs && activityLogs.length > 0 ? (
                  <div className="space-y-4">
                    {activityLogs.slice(0, 4).map((log) => (
                      <ActivityItem key={log.id} activity={log} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-[#E5E5E5]/50 mx-auto mb-3" />
                    <p className="text-[#E5E5E5]">No activity found yet</p>
                  </div>
                )}
                
                <Link href="/activity">
                  <Button className="mt-4 w-full py-2 text-center text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/10 transition-colors">
                    View All Activity
                  </Button>
                </Link>
              </div>
              
              {/* Trusted Contacts */}
              <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic">
                <h3 className="font-montserrat font-medium text-xl text-white mb-4">Trusted Contacts</h3>
                
                {contactsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-secondary" />
                  </div>
                ) : trustedContacts && trustedContacts.length > 0 ? (
                  <div className="space-y-4">
                    {trustedContacts.slice(0, 2).map((contact) => (
                      <TrustedContactItem key={contact.id} contact={contact} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-[#E5E5E5]/50 mx-auto mb-3" />
                    <p className="text-[#E5E5E5]">No trusted contacts added yet</p>
                  </div>
                )}
                
                <Link href="/trusted-contacts">
                  <Button className="mt-6 w-full py-2 bg-secondary hover:bg-secondary/90 text-white rounded-lg transition-colors">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
