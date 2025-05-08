import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  User,
  Lock,
  Bell,
  Shield,
  Key,
  LogOut,
  Save,
  ArrowRight,
  Smartphone,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";

// Define Device type for devices
type Device = {
  id: number;
  deviceId: string;
  deviceName?: string;
  userAgent?: string;
  lastUsed: string;
  ipAddress?: string;
};

export default function SettingsPage() {
  const { user, setupTwoFactorMutation, verifyTwoFactorSetupMutation, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState("profile");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [setupToken, setSetupToken] = useState("");
  const [currentDeviceId, setCurrentDeviceId] = useState(() => localStorage.getItem('deviceId'));
  const { data: devices = [], isLoading: devicesLoading, refetch: refetchDevices } = useQuery<Device[]>({
    queryKey: ["/api/user-devices"],
    queryFn: async () => (await apiRequest("GET", "/api/user-devices")).json(),
  });
  const removeDeviceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/user-devices/${id}`);
    },
    onSuccess: () => refetchDevices(),
  });
  const signOutAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/user-devices/signout-all-others");
    },
    onSuccess: () => refetchDevices(),
  });
  const [showDisable2FADialog, setShowDisable2FADialog] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState("");
  const [disable2FAError, setDisable2FAError] = useState("");
  const disable2FAInputRef = useRef<HTMLInputElement>(null);
  const [disable2FAToken, setDisable2FAToken] = useState("");
  const [sessionTimeout, setSessionTimeout] = useState(() => {
    const stored = localStorage.getItem('sessionTimeoutMinutes');
    return stored ? parseInt(stored, 10) : 30;
  });
  const [sessionTimeoutInput, setSessionTimeoutInput] = useState(sessionTimeout.toString());

  useEffect(() => {
    setSessionTimeoutInput(sessionTimeout.toString());
  }, [sessionTimeout]);

  const handleSessionTimeoutSave = () => {
    const minutes = Math.max(1, parseInt(sessionTimeoutInput, 10) || 30);
    setSessionTimeout(minutes);
    localStorage.setItem('sessionTimeoutMinutes', minutes.toString());
    toast({ title: 'Session Timeout Updated', description: `Session timeout set to ${minutes} minutes.` });
  };

  // Profile form schema
  const profileFormSchema = z.object({
    fullName: z.string().min(3, "Full name must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
  });

  // Password form schema
  const passwordFormSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

  // Notification preferences form schema
  const notificationFormSchema = z.object({
    emailEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
    emailFrequency: z.string(),
    securityAlertsEnabled: z.boolean(),
    activityAlertsEnabled: z.boolean(),
    updatesEnabled: z.boolean(),
  });

  // Setup form objects
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const notificationForm = useForm<z.infer<typeof notificationFormSchema>>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      emailFrequency: "immediate",
      securityAlertsEnabled: true,
      activityAlertsEnabled: true,
      updatesEnabled: true,
    },
  });

  // Handle profile form submission
  const onProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
    try {
      setIsLoading(true);
      const res = await apiRequest("PATCH", "/api/user/profile", values);
      const updatedUser = await res.json();
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password form submission
  const onPasswordSubmit = async (values: z.infer<typeof passwordFormSchema>) => {
    try {
      setIsLoading(true);
      await apiRequest("PATCH", "/api/user/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      passwordForm.reset();
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle notification preferences form submission
  const onNotificationSubmit = async (values: z.infer<typeof notificationFormSchema>) => {
    try {
      setIsLoading(true);
      await apiRequest("PATCH", "/api/user/notification-preferences", values);
      toast({
        title: "Preferences updated",
        description: "Your notification preferences have been updated",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 2FA Setup Dialog logic
  const handle2FASetup = () => {
    setupTwoFactorMutation.mutate();
    setShow2FADialog(true);
    setSetupToken("");
  };
  const handle2FAVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupTwoFactorMutation.data) return;
    verifyTwoFactorSetupMutation.mutate({
      secret: setupTwoFactorMutation.data.secret,
      token: setupToken,
      recoveryKeys: setupTwoFactorMutation.data.recoveryKeys || [],
    });
  };
  const handle2FADisable = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDisable2FAError("");
    try {
      await apiRequest("POST", "/api/disable-2fa", { password: disable2FAPassword, twoFactorToken: disable2FAToken });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowDisable2FADialog(false);
      setDisable2FAPassword("");
      setDisable2FAToken("");
      toast({ title: "2FA Disabled", description: "Two-factor authentication has been disabled." });
    } catch (err: any) {
      setDisable2FAError(err?.message || (err?.error ? err.error : "Failed to disable 2FA"));
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <MobileNav />
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Account Settings</h1>
            <p className="text-gray-400 mb-6">Manage your account settings and preferences</p>

            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList className="grid grid-cols-4 mb-8">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Profile
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Security
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Notifications
                </TabsTrigger>
                <TabsTrigger value="devices" className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" /> Devices
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile">
                <Card className="bg-primary/40 border-0 shadow-neumorphic">
                  <CardHeader>
                    <CardTitle className="text-white">Personal Information</CardTitle>
                    <CardDescription>
                      Update your personal information and account details
                    </CardDescription>
                  </CardHeader>
                  <Separator className="bg-[#1E293B]" />
                  <CardContent className="pt-6">
                    <Form {...profileForm}>
                      <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                        <FormField
                          control={profileForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input
                                  className="bg-primary/40"
                                  placeholder="Your full name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input
                                  className="bg-primary/40"
                                  type="email"
                                  placeholder="Your email address"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-gray-500">
                                This email will be used for account recovery and notifications
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="w-full sm:w-auto"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security">
                <div className="grid gap-6">
                  {/* Password Section */}
                  <Card className="bg-primary/40 border-0 shadow-neumorphic">
                    <CardHeader>
                      <CardTitle className="text-white">Change Password</CardTitle>
                      <CardDescription>
                        Update your password to maintain account security
                      </CardDescription>
                    </CardHeader>
                    <Separator className="bg-[#1E293B]" />
                    <CardContent className="pt-6">
                      <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                          <FormField
                            control={passwordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      className="bg-primary/40 pr-10"
                                      type={showCurrentPassword ? "text" : "password"}
                                      placeholder="Enter current password"
                                      {...field}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-0 top-0 h-full px-3 py-2"
                                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    >
                                      {showCurrentPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={passwordForm.control}
                            name="newPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      className="bg-primary/40 pr-10"
                                      type={showNewPassword ? "text" : "password"}
                                      placeholder="Enter new password"
                                      {...field}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-0 top-0 h-full px-3 py-2"
                                      onClick={() => setShowNewPassword(!showNewPassword)}
                                    >
                                      {showNewPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormDescription className="text-gray-500">
                                  Password must be at least 8 characters with uppercase, lowercase, number and special character
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={passwordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirm Password</FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-primary/40"
                                    type="password"
                                    placeholder="Confirm new password"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full sm:w-auto"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Lock className="mr-2 h-4 w-4" />
                                Update Password
                              </>
                            )}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>

                  {/* Two-Factor Authentication Section */}
                  <Card className="bg-primary/40 border-0 shadow-neumorphic">
                    <CardHeader>
                      <CardTitle className="text-white">Two-Factor Authentication</CardTitle>
                      <CardDescription>
                        Add an extra layer of security to your account
                      </CardDescription>
                    </CardHeader>
                    <Separator className="bg-[#1E293B]" />
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <h3 className="text-lg font-medium text-white">
                            {user?.twoFactorEnabled ? "Two-factor authentication is enabled" : "Two-factor authentication is disabled"}
                          </h3>
                          <p className="text-gray-400 text-sm mt-1">
                            {user?.twoFactorEnabled ? "Your account is protected with an authenticator app" : "Enable 2FA to add an extra layer of security to your account"}
                          </p>
                        </div>
                        {user?.twoFactorEnabled ? (
                          <Button variant="destructive" onClick={() => setShowDisable2FADialog(true)}>Disable 2FA</Button>
                        ) : (
                          <Button onClick={handle2FASetup}>Enable 2FA</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Account Actions Section */}
                  <Card className="bg-primary/40 border-0 shadow-neumorphic">
                    <CardHeader>
                      <CardTitle className="text-white">Account Actions</CardTitle>
                      <CardDescription>
                        Manage your account status and sessions
                      </CardDescription>
                    </CardHeader>
                    <Separator className="bg-[#1E293B]" />
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium text-white">Sign out from all devices</h3>
                            <p className="text-gray-400 text-sm mt-1">
                              This will sign you out from all devices except the current one
                            </p>
                          </div>
                          <Button variant="outline">
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out All
                          </Button>
                        </div>
                        <Separator className="bg-[#1E293B]" />
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium text-red-400">Delete Account</h3>
                            <p className="text-gray-400 text-sm mt-1">
                              Permanently delete your account and all associated data
                            </p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive">Delete Account</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete your
                                  account and remove all your data from our servers.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground">
                                  Delete Account
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications">
                <Card className="bg-primary/40 border-0 shadow-neumorphic mb-8">
                  <CardHeader>
                    <CardTitle className="text-white">Session Timeout</CardTitle>
                    <CardDescription>Set how many minutes before you are automatically logged out for inactivity.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min={1}
                        max={240}
                        value={sessionTimeoutInput}
                        onChange={e => setSessionTimeoutInput(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-gray-400">minutes</span>
                      <Button onClick={handleSessionTimeoutSave} disabled={sessionTimeoutInput === sessionTimeout.toString()}>
                        Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-primary/40 border-0 shadow-neumorphic">
                  <CardHeader>
                    <CardTitle className="text-white">Notification Preferences</CardTitle>
                    <CardDescription>
                      Manage how and when you receive notifications
                    </CardDescription>
                  </CardHeader>
                  <Separator className="bg-[#1E293B]" />
                  <CardContent className="pt-6">
                    <Form {...notificationForm}>
                      <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-6">
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-white">Delivery Methods</h3>
                          <FormField
                            control={notificationForm.control}
                            name="emailEnabled"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[#1E293B] p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Email Notifications</FormLabel>
                                  <FormDescription>
                                    Receive notifications via email
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator className="bg-[#1E293B]" />

                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-white">Email Frequency</h3>
                          <FormField
                            control={notificationForm.control}
                            name="emailFrequency"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email Digest Frequency</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="bg-primary/40">
                                      <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="immediate">Immediate</SelectItem>
                                    <SelectItem value="daily">Daily Digest</SelectItem>
                                    <SelectItem value="weekly">Weekly Digest</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  Choose how often you want to receive email notifications
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator className="bg-[#1E293B]" />

                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-white">Notification Types</h3>
                          <FormField
                            control={notificationForm.control}
                            name="securityAlertsEnabled"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[#1E293B] p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Security Alerts</FormLabel>
                                  <FormDescription>
                                    Login attempts, password changes, and other security events
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={notificationForm.control}
                            name="activityAlertsEnabled"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[#1E293B] p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Activity Alerts</FormLabel>
                                  <FormDescription>
                                    Vault entry changes, trusted contact updates, etc.
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={notificationForm.control}
                            name="updatesEnabled"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[#1E293B] p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Product Updates</FormLabel>
                                  <FormDescription>
                                    New features, improvements, and service announcements
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="w-full sm:w-auto"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Preferences
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Devices Tab */}
              <TabsContent value="devices">
                <Card className="bg-primary/40 border-0 shadow-neumorphic">
                  <CardHeader>
                    <CardTitle className="text-white">Active Devices</CardTitle>
                    <CardDescription>
                      View and manage devices that have access to your account
                    </CardDescription>
                  </CardHeader>
                  <Separator className="bg-[#1E293B]" />
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {devicesLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
                      ) : devices.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">No active devices found.</div>
                      ) : (
                        devices.map(device => (
                          <div key={device.id} className={`rounded-lg border border-[#1E293B] p-4 transition-all duration-300 ${device.deviceId === currentDeviceId ? 'ring-2 ring-secondary/40 bg-secondary/10' : ''}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <div className={`p-2 rounded-full ${device.deviceId === currentDeviceId ? 'bg-secondary/10' : 'bg-gray-700/50'}`}> <Smartphone className={`h-6 w-6 ${device.deviceId === currentDeviceId ? 'text-secondary' : 'text-gray-400'}`} /> </div>
                                <div>
                                  <h3 className="text-lg font-medium text-white">{device.deviceName || device.userAgent || 'Unknown Device'}</h3>
                                  <div className="mt-1 space-y-1 text-sm text-gray-400">
                                    <p>Last active: {new Date(device.lastUsed).toLocaleString()}</p>
                                    <p>IP Address: {device.ipAddress || 'Unknown'}</p>
                                  </div>
                                </div>
                              </div>
                              {device.deviceId === currentDeviceId ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-400">Current</span>
                              ) : (
                                <Button variant="outline" size="sm" className="text-red-400 h-8" onClick={() => removeDeviceMutation.mutate(device.id)} disabled={removeDeviceMutation.isPending}>
                                  <X className="h-4 w-4 mr-1" /> Remove
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-4">
                    <Button variant="destructive" onClick={() => signOutAllMutation.mutate()} disabled={signOutAllMutation.isPending}>
                      <LogOut className="mr-2 h-4 w-4" />
                      {signOutAllMutation.isPending ? 'Signing Out...' : 'Sign Out All Other Devices'}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisable2FADialog} onOpenChange={setShowDisable2FADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>Enter your password and 2FA code to disable 2FA.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handle2FADisable} className="space-y-4">
            <Input
              ref={disable2FAInputRef}
              type="password"
              placeholder="Password"
              value={disable2FAPassword}
              onChange={e => setDisable2FAPassword(e.target.value)}
              autoFocus
            />
            <Input
              type="text"
              placeholder="2FA Code"
              value={disable2FAToken}
              onChange={e => setDisable2FAToken(e.target.value)}
              maxLength={6}
              inputMode="numeric"
            />
            {disable2FAError && <p className="text-sm text-red-400">{disable2FAError}</p>}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowDisable2FADialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-destructive" disabled={!disable2FAPassword || !disable2FAToken}>Disable 2FA</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FADialog && !!setupTwoFactorMutation.data} onOpenChange={setShow2FADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>Scan the QR code with your authenticator app and enter the 6-digit code.</DialogDescription>
          </DialogHeader>
          {setupTwoFactorMutation.data?.qrCode && (
            <div className="flex flex-col items-center justify-center p-4 border border-[#1E293B] rounded-lg bg-white">
              <img src={setupTwoFactorMutation.data.qrCode} alt="2FA QR code" className="w-48 h-48" />
            </div>
          )}
          <form onSubmit={e => { handle2FAVerify(e); setShow2FADialog(false); }} className="space-y-4">
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              maxLength={6}
              value={setupToken}
              onChange={e => setSetupToken(e.target.value)}
              className="bg-primary/40"
            />
            {verifyTwoFactorSetupMutation.isError && (
              <p className="text-sm text-red-400">{verifyTwoFactorSetupMutation.error?.message || "Invalid code."}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShow2FADialog(false)} type="button">Cancel</Button>
              <Button type="submit" className="bg-secondary" disabled={setupToken.length !== 6 || verifyTwoFactorSetupMutation.isPending}>
                {verifyTwoFactorSetupMutation.isPending ? "Verifying..." : "Verify & Enable"}
              </Button>
            </DialogFooter>
          </form>
          {setupTwoFactorMutation.data?.recoveryKeys?.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-200">Recovery Codes</h3>
              <div className="p-4 border border-[#1E293B] rounded-lg bg-primary/40 space-y-1">
                <p className="text-sm text-amber-400 mb-2">Save these recovery codes in a safe place</p>
                <div className="grid grid-cols-2 gap-2">
                  {setupTwoFactorMutation.data?.recoveryKeys?.map((code, idx) => (
                    <code key={idx} className="text-sm font-mono bg-primary/60 p-1 rounded">{code}</code>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}