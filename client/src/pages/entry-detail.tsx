import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { encryptData, decryptData, deriveKeyFromPassword } from "@/lib/encryption";
import { useAuth } from "@/hooks/use-auth";
import { VaultEntry, TrustedContact } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  FileEdit, 
  Trash, 
  Shield, 
  Download, 
  FileImage, 
  File, 
  Clock, 
  Plus,
  Lock,
  Save,
  X,
  AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TrustedContactItem } from "@/components/ui/trusted-contact-item";
import { format } from "date-fns";

// Helper type for decrypted content
interface DecryptedContent {
  fields: Record<string, string>;
  notes: string;
  attachments: Array<{ name: string, type: string }>;
}

export default function EntryDetail() {
  const { id } = useParams();
  const entryId = parseInt(id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // State variables
  const [editMode, setEditMode] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<DecryptedContent | null>(null);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [showDecryptPrompt, setShowDecryptPrompt] = useState(false);
  const [decryptError, setDecryptError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updatedFields, setUpdatedFields] = useState<Record<string, string>>({});
  const [updatedNotes, setUpdatedNotes] = useState("");
  const [autoLockTimer, setAutoLockTimer] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState(300); // 5 minutes default
  
  // Fetch entry details
  const { 
    data: entry,
    isLoading: entryLoading,
    error: entryError
  } = useQuery<VaultEntry>({
    queryKey: [`/api/vault-entries/${entryId}`],
    enabled: !!entryId
  });

  // Fetch trusted contacts for sharing
  const { 
    data: trustedContacts,
    isLoading: contactsLoading
  } = useQuery<TrustedContact[]>({
    queryKey: ["/api/trusted-contacts"]
  });

  // Fetch shared entries for this vault entry
  const { 
    data: sharedEntries,
    isLoading: sharedEntriesLoading
  } = useQuery({
    queryKey: [`/api/shared-entries/${entryId}`],
    enabled: !!entryId
  });

  // Emergency access settings
  const [requireApproval, setRequireApproval] = useState(true);
  const [delayPeriod, setDelayPeriod] = useState("24 hours");
  const [expiryDate, setExpiryDate] = useState("");

  // Form mutation to update entry
  const updateEntryMutation = useMutation({
    mutationFn: async (updatedEntry: Partial<VaultEntry>) => {
      const res = await apiRequest("PUT", `/api/vault-entries/${entryId}`, updatedEntry);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vault-entries/${entryId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/vault-entries"] });
      setEditMode(false);
      toast({
        title: "Entry updated",
        description: "Your vault entry has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/vault-entries/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vault-entries"] });
      toast({
        title: "Entry deleted",
        description: "Your vault entry has been permanently deleted."
      });
      navigate("/vault");
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Share entry mutation
  const shareEntryMutation = useMutation({
    mutationFn: async (shareData: { entryId: number, contactId: number, requireApproval: boolean, delayPeriod: string, expiresAt: string | null }) => {
      const res = await apiRequest("POST", "/api/shared-entries", shareData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shared-entries/${entryId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/vault-entries/${entryId}`] });
      toast({
        title: "Entry shared",
        description: "This entry has been shared with the selected contact.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sharing failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Auto-lock timer for decrypted content
  useEffect(() => {
    if (isDecrypted && !autoLockTimer) {
      // Set timer to hide decrypted content after 5 minutes
      const timer = window.setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsDecrypted(false);
            setDecryptedContent(null);
            setShowDecryptPrompt(false);
            toast({
              title: "Content locked",
              description: "Your decrypted content has been locked for security reasons.",
              variant: "default",
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setAutoLockTimer(timer);
      return () => clearInterval(timer);
    }
  }, [isDecrypted, toast]);

  // Format remaining time
  const formatRemainingTime = () => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle decrypt content
  const handleDecrypt = async () => {
    if (!entry || !decryptPassword) return;
    
    try {
      // Derive encryption key from password
      const key = await deriveKeyFromPassword(decryptPassword);
      
      // Decrypt the content
      const decrypted = await decryptData(entry.content, key);
      
      // If decryption is successful, store decrypted content and set flags
      setDecryptedContent(decrypted);
      setUpdatedFields(decrypted.fields || {});
      setUpdatedNotes(decrypted.notes || "");
      setIsDecrypted(true);
      setShowDecryptPrompt(false);
      setDecryptError("");
      setRemainingTime(300); // Reset timer to 5 minutes
      
      toast({
        title: "Content decrypted",
        description: "Your content is now visible and will automatically lock after 5 minutes.",
      });
    } catch (error) {
      setDecryptError("Incorrect password or corrupted data. Please try again.");
      console.error("Decryption error:", error);
    }
  };

  // Handle save updates
  const handleSaveUpdates = async () => {
    if (!entry || !decryptedContent) return;
    
    try {
      // Create updated content object
      const updatedContent: DecryptedContent = {
        ...decryptedContent,
        fields: updatedFields,
        notes: updatedNotes
      };
      
      // Encrypt the updated content
      const key = await deriveKeyFromPassword(decryptPassword);
      const encryptedContent = await encryptData(updatedContent, key);
      
      // Update the entry
      updateEntryMutation.mutate({
        content: encryptedContent
      });
      
    } catch (error) {
      console.error("Update encryption error:", error);
      toast({
        title: "Update failed",
        description: "Failed to encrypt updated content.",
        variant: "destructive",
      });
    }
  };

  // Handle share with contact
  const handleShareWithContact = (contactId: number) => {
    const expires = expiryDate ? new Date(expiryDate).toISOString() : null;
    
    shareEntryMutation.mutate({
      entryId,
      contactId,
      requireApproval,
      delayPeriod,
      expiresAt: expires
    });
  };

  // Handle delete entry
  const handleDeleteEntry = () => {
    deleteEntryMutation.mutate();
  };

  // Format date
  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    try {
      return format(new Date(date), "MMMM d, yyyy");
    } catch (error) {
      return "Invalid date";
    }
  };

  if (entryLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <MobileNav />
          <div className="p-4 lg:p-8">
            <div className="flex items-center mb-6">
              <Button variant="ghost" className="mr-3">
                <ArrowLeft className="h-5 w-5 text-secondary" />
              </Button>
              <Skeleton className="h-8 w-64 bg-[#1E293B]" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-primary/40 rounded-xl p-6 shadow-neumorphic">
                <Skeleton className="h-6 w-48 mb-6 bg-[#1E293B]" />
                <Skeleton className="h-40 w-full rounded-lg mb-6 bg-[#1E293B]" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-24 mb-1 bg-[#1E293B]" />
                      <Skeleton className="h-8 w-full bg-[#1E293B]" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-4 w-32 mb-2 bg-[#1E293B]" />
                <Skeleton className="h-24 w-full rounded-lg bg-[#1E293B]" />
              </div>
              <div className="space-y-6">
                <Skeleton className="h-40 w-full rounded-xl bg-[#1E293B]" />
                <Skeleton className="h-64 w-full rounded-xl bg-[#1E293B]" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (entryError || !entry) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <MobileNav />
          <div className="p-4 lg:p-8 flex flex-col items-center justify-center min-h-[80vh]">
            <div className="bg-primary/40 rounded-xl p-8 max-w-md shadow-neumorphic text-center">
              <AlertTriangle className="h-12 w-12 text-[#F23557] mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Entry Not Found</h2>
              <p className="text-[#E5E5E5] mb-6">
                We couldn't find the vault entry you're looking for. It may have been deleted or you may not have permission to view it.
              </p>
              <Link href="/vault">
                <Button className="bg-secondary hover:bg-secondary/90">
                  Back to Vault
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Special handling for decrypt prompt
  if (showDecryptPrompt && !isDecrypted) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <MobileNav />
          <div className="p-4 lg:p-8 flex flex-col items-center justify-center min-h-[80vh]">
            <div className="bg-primary/40 rounded-xl p-8 max-w-md shadow-neumorphic">
              <div className="text-center mb-6">
                <Lock className="h-12 w-12 text-secondary mx-auto mb-4" />
                <h2 className="text-2xl font-bold">Decrypt Content</h2>
                <p className="text-[#E5E5E5] mt-2">
                  Enter your password to decrypt this entry's content.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="decryptPassword">Password</Label>
                  <Input
                    id="decryptPassword"
                    type="password"
                    placeholder="Enter your password"
                    value={decryptPassword}
                    onChange={(e) => setDecryptPassword(e.target.value)}
                    className="bg-[#1E293B]/50 border-primary"
                  />
                  {decryptError && (
                    <p className="text-[#F23557] text-sm">{decryptError}</p>
                  )}
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDecryptPrompt(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 bg-secondary hover:bg-secondary/90"
                    onClick={handleDecrypt}
                  >
                    Decrypt
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <MobileNav />
        
        <div className="p-4 lg:p-8">
          {/* Header */}
          <div className="flex items-center mb-6">
            <Link href="/vault">
              <Button variant="ghost" className="mr-3 text-secondary hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h2 className="font-montserrat font-bold text-2xl text-white">{entry.title}</h2>
            <div className="ml-3">
              <StatusBadge status={entry.status} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 bg-primary/40 rounded-xl p-6 shadow-neumorphic">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-medium text-xl text-white">Document Details</h3>
                
                <div className="flex space-x-2">
                  {isDecrypted ? (
                    editMode ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="text-[#E5E5E5] hover:text-[#F23557] border-[#E5E5E5]"
                          onClick={() => setEditMode(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button 
                          className="bg-secondary hover:bg-secondary/90 text-white shadow-neumorphic hover:shadow-glow"
                          onClick={handleSaveUpdates}
                          disabled={updateEntryMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          className="bg-secondary hover:bg-secondary/90 text-white shadow-neumorphic hover:shadow-glow"
                          onClick={() => setEditMode(true)}
                        >
                          <FileEdit className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button 
                              className="bg-[#F23557] hover:bg-[#F23557]/90 text-white shadow-neumorphic hover:shadow-glow"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#1A2342] border-[#1E293B]">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this entry? This action cannot be undone
                                and all entry data will be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeleteEntry();
                                }}
                                className="bg-[#F23557] hover:bg-[#F23557]/90"
                              >
                                {deleteEntryMutation.isPending ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )
                  ) : (
                    <Button 
                      className="bg-secondary hover:bg-secondary/90 text-white shadow-neumorphic hover:shadow-glow"
                      onClick={() => setShowDecryptPrompt(true)}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Decrypt
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Decryption Status */}
              {isDecrypted ? (
                <div className="bg-[#1E293B]/50 rounded-lg p-4 mb-6 border border-primary">
                  <div className="flex items-center mb-4">
                    <div className="animate-pulse-subtle">
                      <Shield className="text-secondary mr-2 h-5 w-5" />
                    </div>
                    <p className="text-white">Content decrypted and visible</p>
                    <div className="ml-auto">
                      <span className="text-xs text-gray-400">
                        Automatically locks in <span className="text-[#F8B400]">{formatRemainingTime()}</span>
                      </span>
                    </div>
                  </div>
                  
                  {/* Content Display/Edit Area */}
                  {decryptedContent && (
                    <>
                      {/* Fields - Display or Edit based on mode */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-decrypt mb-6">
                        {Object.entries(decryptedContent.fields).map(([key, value]) => (
                          <div key={key}>
                            <Label className="block text-gray-400 text-sm mb-1">
                              {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </Label>
                            {editMode ? (
                              <Input
                                value={updatedFields[key] || ""}
                                onChange={e => setUpdatedFields({...updatedFields, [key]: e.target.value})}
                                className="bg-[#1E293B]/70 border-primary text-white"
                              />
                            ) : (
                              <p className="text-white font-mono">{value}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Notes Section */}
                      <div className="mb-6">
                        <Label className="block text-gray-400 text-sm mb-1">Notes</Label>
                        {editMode ? (
                          <Textarea
                            value={updatedNotes}
                            onChange={e => setUpdatedNotes(e.target.value)}
                            className="bg-[#1E293B]/70 border-primary text-white min-h-[100px]"
                          />
                        ) : (
                          <div className="bg-[#1E293B]/70 rounded-lg p-4 border border-primary">
                            <p className="text-[#E5E5E5] animate-decrypt animate-typewriter">
                              {decryptedContent.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Attachments */}
                      {decryptedContent.attachments && decryptedContent.attachments.length > 0 && (
                        <div>
                          <h4 className="font-montserrat font-medium text-white mb-2">Attachments</h4>
                          <div className="bg-[#1E293B]/50 rounded-lg p-4 border border-primary">
                            {decryptedContent.attachments.map((attachment, index) => (
                              <div key={index} 
                                className="flex items-center justify-between p-3 hover:bg-primary hover:bg-opacity-30 rounded-lg transition-colors">
                                <div className="flex items-center">
                                  {attachment.type === 'pdf' ? (
                                    <File className="text-[#F23557] mr-3 h-5 w-5" />
                                  ) : (
                                    <FileImage className="text-secondary mr-3 h-5 w-5" />
                                  )}
                                  <span className="text-white">{attachment.name}</span>
                                </div>
                                <div>
                                  <Button variant="ghost" className="text-secondary hover:text-white p-1">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-[#1E293B]/50 rounded-lg p-12 mb-6 border border-primary flex flex-col items-center justify-center text-center">
                  <Lock className="h-16 w-16 text-secondary/50 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Encrypted Content</h3>
                  <p className="text-[#E5E5E5] mb-6 max-w-md">
                    This content is encrypted and secure. Click the Decrypt button to view the contents.
                  </p>
                  <Button 
                    className="bg-secondary hover:bg-secondary/90 text-white"
                    onClick={() => setShowDecryptPrompt(true)}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Decrypt Content
                  </Button>
                </div>
              )}
              
              {/* Entry metadata (always visible) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label className="block text-gray-400 text-sm mb-1">Created</Label>
                  <p className="text-white">{formatDate(entry.createdAt)}</p>
                </div>
                <div>
                  <Label className="block text-gray-400 text-sm mb-1">Last Updated</Label>
                  <p className="text-white">{formatDate(entry.updatedAt)}</p>
                </div>
                <div>
                  <Label className="block text-gray-400 text-sm mb-1">Status</Label>
                  <div className="text-white">
                    <StatusBadge status={entry.status} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Sidebar */}
            <div className="space-y-6">
              {/* Security Information */}
              <div className="bg-primary/40 rounded-xl p-5 shadow-neumorphic">
                <h3 className="font-montserrat font-medium text-white mb-4">Security Information</h3>
                
                <div className="space-y-3">
                  <div>
                    <Label className="block text-gray-400 text-sm mb-1">Encryption Level</Label>
                    <p className="text-secondary">AES-256 (Military Grade)</p>
                  </div>
                  
                  <div>
                    <Label className="block text-gray-400 text-sm mb-1">Last Accessed</Label>
                    <p className="text-white">{formatDate(entry.updatedAt)}</p>
                  </div>
                  
                  <div>
                    <Label className="block text-gray-400 text-sm mb-1">Access History</Label>
                    <Button variant="link" className="text-secondary text-sm p-0 h-auto hover:text-white">
                      View Complete Log
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Sharing Options */}
              <div className="bg-primary/40 rounded-xl p-5 shadow-neumorphic">
                <h3 className="font-montserrat font-medium text-white mb-4">Sharing Options</h3>
                
                <p className="text-sm text-[#E5E5E5] mb-4">
                  Share this document with trusted contacts for emergency access.
                </p>
                
                {contactsLoading ? (
                  <div className="flex justify-center py-2 mb-3">
                    <Loader2 className="h-6 w-6 animate-spin text-secondary" />
                  </div>
                ) : trustedContacts && trustedContacts.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {trustedContacts
                      .filter(contact => contact.status === 'active')
                      .map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-3 bg-[#1E293B]/50 rounded-lg">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 bg-secondary/20 rounded-full flex items-center justify-center">
                              <span className="text-sm text-secondary font-medium">
                                {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                            <span className="ml-2 text-white truncate max-w-[120px]">{contact.name}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-secondary hover:text-white"
                            onClick={() => handleShareWithContact(contact.id)}
                            disabled={shareEntryMutation.isPending}
                          >
                            {shareEntryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-3 mb-3 bg-[#1E293B]/30 rounded-lg">
                    <p className="text-sm text-[#E5E5E5]">No active trusted contacts</p>
                  </div>
                )}
                
                <Link href="/trusted-contacts">
                  <Button className="w-full bg-secondary hover:bg-secondary/90 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Trusted Contact
                  </Button>
                </Link>
              </div>
              
              {/* Emergency Access */}
              <div className="bg-primary/40 rounded-xl p-5 shadow-neumorphic">
                <h3 className="font-montserrat font-medium text-white mb-4">Emergency Access</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Label htmlFor="require-approval" className="flex-1 text-[#E5E5E5]">Require Approval</Label>
                    <Switch
                      id="require-approval"
                      checked={requireApproval}
                      onCheckedChange={setRequireApproval}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="delay-period" className="text-[#E5E5E5]">Delay Period</Label>
                    <Select value={delayPeriod} onValueChange={setDelayPeriod}>
                      <SelectTrigger className="bg-[#1E293B] border-primary">
                        <SelectValue placeholder="Select a delay period" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1E293B] border-primary">
                        <SelectItem value="24 hours">24 hours</SelectItem>
                        <SelectItem value="48 hours">48 hours</SelectItem>
                        <SelectItem value="72 hours">72 hours</SelectItem>
                        <SelectItem value="1 week">1 week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="expiry-date" className="text-[#E5E5E5]">Auto-Expire Access</Label>
                    <Input
                      id="expiry-date"
                      type="date"
                      className="bg-[#1E293B] border-primary text-white"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
