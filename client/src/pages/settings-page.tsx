import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
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

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState("profile");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [twoFactorQRCode, setTwoFactorQRCode] = useState("");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [twoFactorRecoveryCodes, setTwoFactorRecoveryCodes] = useState<string[]>([]);
  const [showEnableTwoFactorDialog, setShowEnableTwoFactorDialog] = useState(false);
  const [twoFaToken, setTwoFaToken] = useState("");
  const [twoFaTokenError, setTwoFaTokenError] = useState("");
  const [twoFactorDisableConfirmOpen, setTwoFactorDisableConfirmOpen] = useState(false);

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

  // Get 2FA setup data
  const setupTwoFactor = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest("GET", "/api/user/2fa/setup", null);
      const data = await res.json();
      setTwoFactorSecret(data.secret);
      
      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(data.otpauth_url);
      setTwoFactorQRCode(qrCodeUrl);
      
      // Show dialog
      setShowEnableTwoFactorDialog(true);
    } catch (error) {
      toast({
        title: "Setup failed",
        description: error instanceof Error ? error.message : "Failed to set up two-factor authentication",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Enable 2FA
  const enableTwoFactor = async () => {
    try {
      setIsLoading(true);
      setTwoFaTokenError("");
      
      const res = await apiRequest("POST", "/api/user/2fa/enable", {
        secret: twoFactorSecret,
        token: twoFaToken,
      });
      
      const data = await res.json();
      setTwoFactorRecoveryCodes(data.recoveryCodes);
      
      // Update user data
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled successfully",
      });
    } catch (error) {
      setTwoFaTokenError(error instanceof Error ? error.message : "Invalid verification code");
    } finally {
      setIsLoading(false);
    }
  };

  // Disable 2FA
  const disableTwoFactor = async () => {
    try {
      setIsLoading(true);
      await apiRequest("POST", "/api/user/2fa/disable", null);
      
      // Update user data
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      setTwoFactorDisableConfirmOpen(false);
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled",
      });
    } catch (error) {
      toast({
        title: "Disable failed",
        description: error instanceof Error ? error.message : "Failed to disable two-factor authentication",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
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
                          {user?.twoFactorEnabled
                            ? "Two-factor authentication is enabled"
                            : "Two-factor authentication is disabled"}
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">
                          {user?.twoFactorEnabled
                            ? "Your account is protected with an authenticator app"
                            : "Enable 2FA to add an extra layer of security to your account"}
                        </p>
                      </div>
                      {user?.twoFactorEnabled ? (
                        <AlertDialog
                          open={twoFactorDisableConfirmOpen}
                          onOpenChange={setTwoFactorDisableConfirmOpen}
                        >
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                              <Shield className="mr-2 h-4 w-4" />
                              Disable 2FA
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the additional layer of security from your account.
                                Your account will be protected only by your password.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={disableTwoFactor}
                                disabled={isLoading}
                                className="bg-destructive text-destructive-foreground"
                              >
                                {isLoading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Disabling...
                                  </>
                                ) : (
                                  "Disable 2FA"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button onClick={setupTwoFactor} disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Setting up...
                            </>
                          ) : (
                            <>
                              <Shield className="mr-2 h-4 w-4" />
                              Enable 2FA
                            </>
                          )}
                        </Button>
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

                        <FormField
                          control={notificationForm.control}
                          name="pushEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[#1E293B] p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Push Notifications</FormLabel>
                                <FormDescription>
                                  Receive push notifications on your devices
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
                          name="inAppEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[#1E293B] p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">In-App Notifications</FormLabel>
                                <FormDescription>
                                  Receive notifications within the application
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
                    <div className="rounded-lg border border-[#1E293B] p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-full bg-secondary/10">
                            <Smartphone className="h-6 w-6 text-secondary" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-white">
                              Current Device (Chrome on MacOS)
                            </h3>
                            <div className="mt-1 space-y-1 text-sm text-gray-400">
                              <p>Last active: Just now</p>
                              <p>IP Address: 192.168.1.1</p>
                              <p>Location: New York, USA</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-400">
                            Current
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#1E293B] p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-full bg-gray-700/50">
                            <Smartphone className="h-6 w-6 text-gray-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-white">
                              Safari on iPhone 14
                            </h3>
                            <div className="mt-1 space-y-1 text-sm text-gray-400">
                              <p>Last active: 2 days ago</p>
                              <p>IP Address: 172.24.0.1</p>
                              <p>Location: San Francisco, USA</p>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="text-red-400 h-8">
                          <X className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#1E293B] p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-full bg-gray-700/50">
                            <Smartphone className="h-6 w-6 text-gray-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-white">
                              Firefox on Windows
                            </h3>
                            <div className="mt-1 space-y-1 text-sm text-gray-400">
                              <p>Last active: 1 week ago</p>
                              <p>IP Address: 10.0.0.15</p>
                              <p>Location: Chicago, USA</p>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="text-red-400 h-8">
                          <X className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-4">
                  <Button variant="destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out All Other Devices
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Two-Factor Setup Dialog */}
      <Dialog open={showEnableTwoFactorDialog} onOpenChange={setShowEnableTwoFactorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app and enter the verification code to enable 2FA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {twoFactorQRCode && (
              <div className="flex flex-col items-center justify-center p-4 border border-[#1E293B] rounded-lg bg-white">
                <img
                  src={twoFactorQRCode}
                  alt="Two-factor authentication QR code"
                  className="w-48 h-48"
                />
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="twoFactorCode" className="text-sm font-medium text-gray-200">
                Verification Code
              </label>
              <Input
                id="twoFactorCode"
                type="text"
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="bg-primary/40"
                value={twoFaToken}
                onChange={(e) => {
                  setTwoFaToken(e.target.value);
                  setTwoFaTokenError("");
                }}
              />
              {twoFaTokenError && (
                <p className="text-sm text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> {twoFaTokenError}
                </p>
              )}
            </div>

            {twoFactorRecoveryCodes.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-200">Recovery Codes</h3>
                <div className="p-4 border border-[#1E293B] rounded-lg bg-primary/40 space-y-1">
                  <p className="text-sm text-amber-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Save these recovery codes in a safe place
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {twoFactorRecoveryCodes.map((code, index) => (
                      <code key={index} className="text-sm font-mono bg-primary/60 p-1 rounded">
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEnableTwoFactorDialog(false);
                setTwoFaToken("");
                setTwoFaTokenError("");
              }}
            >
              Cancel
            </Button>
            {twoFactorRecoveryCodes.length > 0 ? (
              <Button
                onClick={() => {
                  setShowEnableTwoFactorDialog(false);
                }}
                className="bg-secondary"
              >
                Done
              </Button>
            ) : (
              <Button
                onClick={enableTwoFactor}
                disabled={!twoFaToken || twoFaToken.length !== 6 || isLoading}
                className="bg-secondary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Verify & Enable
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}