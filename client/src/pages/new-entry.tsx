import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { encryptData, deriveKeyFromPassword } from "@/lib/encryption";
import { InsertVaultEntry } from "@shared/schema";
import { Loader2, ArrowLeft, Calendar, Upload, Lock, X, FileImage, Eye, EyeOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// Define field types for various categories
const fieldTemplates = {
  personal_documents: [
    { name: "documentNumber", label: "Document Number", type: "text" },
    { name: "issuedBy", label: "Issued By", type: "text" },
    { name: "issueDate", label: "Issue Date", type: "date" },
    { name: "expirationDate", label: "Expiration Date", type: "date" }
  ],
  financial_records: [
    { name: "accountNumber", label: "Account Number", type: "text" },
    { name: "routingNumber", label: "Routing Number", type: "text" },
    { name: "institution", label: "Institution", type: "text" },
    { name: "accountType", label: "Account Type", type: "text" }
  ],
  account_credentials: [
    { name: "username", label: "Username", type: "text" },
    { name: "password", label: "Password", type: "password" },
    { name: "website", label: "Website", type: "text" },
    { name: "securityQuestions", label: "Security Questions", type: "textarea" }
  ],
  medical_information: [
    { name: "provider", label: "Provider", type: "text" },
    { name: "policyNumber", label: "Policy/Record Number", type: "text" },
    { name: "condition", label: "Condition/Treatment", type: "text" },
    { name: "medications", label: "Medications", type: "textarea" }
  ],
  other: [
    { name: "field1", label: "Custom Field 1", type: "text" },
    { name: "field2", label: "Custom Field 2", type: "text" },
    { name: "field3", label: "Custom Field 3", type: "text" },
    { name: "field4", label: "Custom Field 4", type: "text" }
  ]
};

export default function NewEntry() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionProgress, setEncryptionProgress] = useState(0);
  const [showEncryptionDialog, setShowEncryptionDialog] = useState(false);
  
  // Auto-delete options
  const [enableAutoDelete, setEnableAutoDelete] = useState(false);
  const [autoDeleteDate, setAutoDeleteDate] = useState<Date | undefined>(undefined);
  
  // Visibility settings
  const [visibilityOption, setVisibilityOption] = useState<string>("private");
  const [inactiveDays, setInactiveDays] = useState<number>(30);
  const [unlockDate, setUnlockDate] = useState<Date | undefined>(undefined);
  
  // File upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Handle field change
  const handleFieldChange = (fieldName: string, value: string) => {
    setFields({
      ...fields,
      [fieldName]: value
    });
  };

  // Handle tag input
  const handleTagsInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (tagsInput.trim()) {
        setTags([...tags, tagsInput.trim()]);
        setTagsInput("");
      }
    }
  };

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      setSelectedFiles([...selectedFiles, ...fileArray]);
    }
  };

  // Remove file
  const removeFile = (fileToRemove: File) => {
    setSelectedFiles(selectedFiles.filter(file => file !== fileToRemove));
  };

  // Create entry mutation
  const createEntryMutation = useMutation({
    mutationFn: async (entryData: InsertVaultEntry) => {
      const res = await apiRequest("POST", "/api/vault-entries", entryData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vault-entries"] });
      toast({
        title: "Entry created",
        description: "Your vault entry has been securely stored.",
      });
      navigate("/vault");
    },
    onError: (error: Error) => {
      toast({
        title: "Creation failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Validate form
  const validateForm = (): boolean => {
    if (!title) {
      toast({
        title: "Missing title",
        description: "Please provide a title for your entry.",
        variant: "destructive",
      });
      return false;
    }
    
    if (!category) {
      toast({
        title: "Missing category",
        description: "Please select a category for your entry.",
        variant: "destructive",
      });
      return false;
    }
    
    if (!password) {
      toast({
        title: "Missing password",
        description: "Please provide a password to encrypt your entry.",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setShowEncryptionDialog(true);
      setIsEncrypting(true);
      setEncryptionProgress(10);
      
      // Prepare the content object
      const contentObject = {
        fields,
        notes,
        attachments: selectedFiles.map(file => ({
          name: file.name,
          type: file.type
        }))
      };
      
      // Simulate encryption progress
      const progressInterval = setInterval(() => {
        setEncryptionProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);
      
      // Derive key from password
      const key = await deriveKeyFromPassword(password);
      setEncryptionProgress(95);
      
      // Encrypt content
      const encryptedContent = await encryptData(contentObject, key);
      setEncryptionProgress(100);
      
      // Prepare the entry data
      const entryData: InsertVaultEntry = {
        userId: user!.id,
        title,
        category,
        content: encryptedContent,
        tags: tags.length > 0 ? tags : undefined,
        status: visibilityOption !== "private" ? "shared" : "active",
        allowEmergencyAccess: visibilityOption === "share_if_inactive",
        autoDeleteAt: enableAutoDelete && autoDeleteDate ? autoDeleteDate : undefined
      };
      
      // Save additional metadata
      if (visibilityOption === "share_if_inactive" || visibilityOption === "unlock_after_date") {
        entryData.metadata = {
          visibilityOption,
          inactiveDays: visibilityOption === "share_if_inactive" ? inactiveDays : undefined,
          unlockDate: visibilityOption === "unlock_after_date" && unlockDate ? unlockDate.toISOString() : undefined
        };
      }
      
      // Create the entry
      await createEntryMutation.mutateAsync(entryData);
      
      // Upload files (not implemented in this version)
      // In a real implementation, you would encrypt and upload each file
      
      setIsEncrypting(false);
      
    } catch (error) {
      console.error("Encryption error:", error);
      setIsEncrypting(false);
      toast({
        title: "Encryption failed",
        description: "There was an error encrypting your data. Please try again.",
        variant: "destructive",
      });
    }
  };

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
            <h2 className="font-montserrat font-bold text-2xl text-white">Create New Entry</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic">
                <h3 className="font-montserrat font-medium text-xl text-white mb-4">Basic Information</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-[#1E293B]/50 border-primary"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-[#1E293B]/50 border-primary">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal_documents">Personal Documents</SelectItem>
                        <SelectItem value="financial_records">Financial Records</SelectItem>
                        <SelectItem value="account_credentials">Account Credentials</SelectItem>
                        <SelectItem value="medical_information">Medical Information</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (optional)</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {tags.map((tag, index) => (
                        <div 
                          key={index} 
                          className="bg-secondary/20 text-secondary px-2 py-1 rounded-md text-sm flex items-center"
                        >
                          {tag}
                          <button 
                            onClick={() => removeTag(tag)}
                            className="ml-2 text-secondary hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Input
                      id="tags"
                      placeholder="Type tag and press Enter"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      onKeyDown={handleTagsInputKeyDown}
                      className="bg-[#1E293B]/50 border-primary"
                    />
                    <p className="text-xs text-[#E5E5E5]/70">Press Enter or comma to add a tag</p>
                  </div>
                </div>
              </div>
              
              {/* Content Fields */}
              {category && (
                <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-montserrat font-medium text-xl text-white">
                      <CategoryBadge category={category} />
                      <span className="ml-2">Content</span>
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {fieldTemplates[category as keyof typeof fieldTemplates]?.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <Label htmlFor={field.name}>{field.label}</Label>
                        
                        {field.type === 'textarea' ? (
                          <Textarea
                            id={field.name}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                            value={fields[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="bg-[#1E293B]/50 border-primary min-h-[100px]"
                          />
                        ) : field.type === 'password' ? (
                          <div className="relative">
                            <Input
                              id={field.name}
                              type={showPassword ? "text" : "password"}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                              value={fields[field.name] || ''}
                              onChange={(e) => handleFieldChange(field.name, e.target.value)}
                              className="bg-[#1E293B]/50 border-primary pr-10"
                            />
                            <button
                              type="button"
                              onClick={togglePasswordVisibility}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        ) : field.type === 'date' ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal bg-[#1E293B]/50 border-primary"
                              >
                                {fields[field.name] ? (
                                  format(new Date(fields[field.name]), "PPP")
                                ) : (
                                  <span className="text-muted-foreground">Pick a date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-[#121827] border-[#2D3748]" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={fields[field.name] ? new Date(fields[field.name]) : undefined}
                                onSelect={(date) => handleFieldChange(field.name, date ? date.toISOString() : '')}
                                className="rounded-md border border-[#2D3748]"
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Input
                            id={field.name}
                            type={field.type}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                            value={fields[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="bg-[#1E293B]/50 border-primary"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="notes">Additional Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any additional notes or information here..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="bg-[#1E293B]/50 border-primary min-h-[150px]"
                    />
                  </div>
                </div>
              )}
              
              {/* File Attachments */}
              <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic">
                <h3 className="font-montserrat font-medium text-xl text-white mb-4">Attachments (Coming Soon)</h3>
                
                <div className="space-y-4">
                  <div 
                    className="border-2 border-dashed border-[#2D3748] rounded-lg p-8 text-center hover:border-secondary/70 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="h-10 w-10 mx-auto text-[#E5E5E5]/50 mb-3" />
                    <h4 className="text-lg font-medium mb-1">Upload Files</h4>
                    <p className="text-[#E5E5E5]/70 text-sm mb-3">
                      Drag and drop files here, or click to browse
                    </p>
                    <p className="text-[#E5E5E5]/50 text-xs">
                      Max file size: 10MB
                    </p>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                  
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <Label>Selected Files</Label>
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-[#1E293B] p-3 rounded-lg">
                            <div className="flex items-center">
                              <FileImage className="h-5 w-5 text-secondary mr-3" />
                              <div>
                                <p className="text-sm font-medium">{file.name}</p>
                                <p className="text-xs text-[#E5E5E5]/70">{(file.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#E5E5E5] hover:text-[#F23557]"
                              onClick={() => removeFile(file)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Settings */}
            <div className="space-y-6">
              {/* Security Settings */}
              <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic">
                <h3 className="font-montserrat font-medium text-xl text-white mb-4">Security</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="encrypt-password">Encryption Password</Label>
                    <div className="relative">
                      <Input
                        id="encrypt-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password to encrypt"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-[#1E293B]/50 border-primary pr-10"
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-[#E5E5E5]/70">
                      This password will be used to encrypt your data. You will need to provide it again to view the content.
                    </p>
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-delete" className="cursor-pointer">Auto-Delete</Label>
                      <Switch 
                        id="auto-delete" 
                        checked={enableAutoDelete}
                        onCheckedChange={setEnableAutoDelete}
                      />
                    </div>
                    {enableAutoDelete && (
                      <div className="pt-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal bg-[#1E293B]/50 border-primary"
                            >
                              {autoDeleteDate ? (
                                format(autoDeleteDate, "PPP")
                              ) : (
                                <span className="text-muted-foreground">Pick a date</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-[#121827] border-[#2D3748]" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={autoDeleteDate}
                              onSelect={setAutoDeleteDate}
                              initialFocus
                              disabled={(date) => date < new Date()}
                              className="rounded-md border border-[#2D3748]"
                            />
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-[#E5E5E5]/70 mt-2">
                          This entry will be permanently deleted on the selected date.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Visibility Settings */}
              <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic">
                <h3 className="font-montserrat font-medium text-xl text-white mb-4">Visibility Settings</h3>
                
                <div className="space-y-4">
                  <Tabs defaultValue="private" value={visibilityOption} onValueChange={setVisibilityOption}>
                    <TabsList className="grid w-full grid-cols-1 h-auto bg-[#1E293B]">
                      <TabsTrigger value="private" className="py-3 data-[state=active]:bg-secondary">
                        Private (Default)
                      </TabsTrigger>
                      <TabsTrigger value="share_if_inactive" className="py-3 data-[state=active]:bg-secondary">
                        Share if Inactive
                      </TabsTrigger>
                      <TabsTrigger value="unlock_after_date" className="py-3 data-[state=active]:bg-secondary">
                        Unlock After Date
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="private" className="pt-4">
                      <p className="text-[#E5E5E5]">
                        This entry will remain private and only accessible by you with your password.
                      </p>
                    </TabsContent>
                    
                    <TabsContent value="share_if_inactive" className="pt-4 space-y-4">
                      <p className="text-[#E5E5E5]">
                        This entry will be shared with your trusted contact if you're inactive for a specified period.
                      </p>
                      
                      <div className="space-y-2">
                        <Label htmlFor="inactive-days">Share after inactive for</Label>
                        <Select 
                          value={inactiveDays.toString()} 
                          onValueChange={(value) => setInactiveDays(parseInt(value))}
                        >
                          <SelectTrigger className="bg-[#1E293B]/50 border-primary">
                            <SelectValue placeholder="Select days" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="60">60 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="180">180 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="unlock_after_date" className="pt-4 space-y-4">
                      <p className="text-[#E5E5E5]">
                        This entry will be automatically unlocked on a specific date.
                      </p>
                      
                      <div className="space-y-2">
                        <Label htmlFor="unlock-date">Unlock Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal bg-[#1E293B]/50 border-primary"
                            >
                              {unlockDate ? (
                                format(unlockDate, "PPP")
                              ) : (
                                <span className="text-muted-foreground">Pick a date</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-[#121827] border-[#2D3748]" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={unlockDate}
                              onSelect={setUnlockDate}
                              initialFocus
                              disabled={(date) => date < new Date()}
                              className="rounded-md border border-[#2D3748]"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
              
              {/* Submit Button */}
              <Button 
                className="w-full bg-secondary hover:bg-secondary/90 text-white text-lg py-6 shadow-neumorphic hover:shadow-glow-strong transition-all duration-300"
                onClick={handleSubmit}
                disabled={isEncrypting}
              >
                {isEncrypting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Encrypting...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Create Secure Entry
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      {/* Encryption Dialog */}
      <AlertDialog open={showEncryptionDialog} onOpenChange={setShowEncryptionDialog}>
        <AlertDialogContent className="bg-[#121827] border-[#2D3748]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">
              {isEncrypting ? "Encrypting Your Data" : "Encryption Complete"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {isEncrypting ? 
                "Please wait while we securely encrypt your entry data..." : 
                "Your entry has been successfully encrypted and saved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-4">
            <div className="h-2 w-full bg-[#1E293B] rounded-full overflow-hidden">
              <div 
                className="h-full bg-secondary transition-all duration-300" 
                style={{ width: `${encryptionProgress}%` }} 
              />
            </div>
            <p className="text-center mt-2 text-sm text-[#E5E5E5]/70">
              {encryptionProgress}% Complete
            </p>
          </div>
          
          <AlertDialogFooter>
            {!isEncrypting && (
              <AlertDialogCancel asChild>
                <Button variant="secondary">Close</Button>
              </AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}