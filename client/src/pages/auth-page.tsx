import { useState, useEffect } from "react";
import { FolderLock, Eye, EyeOff, Mail, Lock, User, Shield, AlertCircle, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function AuthPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ 
    username: "", 
    email: "", 
    password: "", 
    fullName: "",
    twoFactorEnabled: false
  });
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [formTab, setFormTab] = useState("login");
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  
  const { 
    user, 
    loginMutation, 
    registerMutation, 
    verifyTwoFactorMutation,
    setupTwoFactorMutation,
    verifyTwoFactorSetupMutation,
    requires2FA,
    userId2FA,
    twoFactorSetupData,
    calculatePasswordStrength
  } = useAuth();
  
  const [, navigate] = useLocation();
  
  // If user is already logged in, redirect to home
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);
  
  // Update password strength when password changes
  useEffect(() => {
    if (registerForm.password) {
      setPasswordStrength(calculatePasswordStrength(registerForm.password));
    } else {
      setPasswordStrength(0);
    }
  }, [registerForm.password, calculatePasswordStrength]);
  
  // Show the 2FA setup UI when twoFactorSetupData is available
  useEffect(() => {
    if (twoFactorSetupData) {
      setShowTwoFactorSetup(true);
    } else {
      setShowTwoFactorSetup(false);
    }
  }, [twoFactorSetupData]);
  
  // Handle successful registration
  useEffect(() => {
    // If registration was successful and 2FA was requested
    if (user && registerForm.twoFactorEnabled) {
      handle2FASetupStart();
    }
  }, [user, registerForm.twoFactorEnabled]);
  
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
  };
  
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Make sure email is set to username if using email as username
    const formData = {
      ...registerForm,
      email: registerForm.email || registerForm.username
    };
    registerMutation.mutate(formData);
  };
  
  const handleTwoFactorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userId2FA) {
      verifyTwoFactorMutation.mutate({
        userId: userId2FA,
        twoFactorToken
      });
    }
  };
  
  // Start 2FA setup process 
  const handle2FASetupStart = () => {
    setupTwoFactorMutation.mutate();
  };
  
  // Complete 2FA setup verification
  const handle2FASetupVerify = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (twoFactorSetupData && setupToken) {
      verifyTwoFactorSetupMutation.mutate({
        secret: twoFactorSetupData.secret,
        token: setupToken,
        recoveryKeys: twoFactorSetupData.recoveryCodes
      });
    }
  };
  
  // Helper function for password strength color
  const getPasswordStrengthColor = () => {
    if (passwordStrength < 30) return "bg-red-500";
    if (passwordStrength < 60) return "bg-yellow-500";
    return "bg-green-500";
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Auth Form */}
        <div>
          <Card className="bg-primary/40 backdrop-blur-md shadow-neumorphic border-0">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <FolderLock className="h-12 w-12 text-secondary" />
              </div>
              <CardTitle className="text-3xl font-bold text-white">VaultBox</CardTitle>
              <CardDescription className="text-[#E5E5E5]">
                Your life's critical information, securely stored.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
                <TabsList className="grid grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  {requires2FA ? (
                    <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
                      <div className="mb-4 p-4 bg-secondary/10 rounded-lg border border-secondary/20 text-center">
                        <Shield className="h-12 w-12 text-secondary mx-auto mb-2" />
                        <h3 className="text-lg font-semibold text-white mb-1">Two-Factor Authentication</h3>
                        <p className="text-[#E5E5E5] text-sm">
                          Please enter the 6-digit code from your authenticator app to complete the login process.
                        </p>
                      </div>
                    
                      <div className="space-y-2">
                        <Label htmlFor="twoFactorToken">Authentication Code</Label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
                          <Input
                            id="twoFactorToken"
                            type="text"
                            placeholder="123456"
                            className="pl-10 bg-[#1E293B]/50 border-primary text-center font-mono text-lg tracking-widest"
                            value={twoFactorToken}
                            onChange={(e) => setTwoFactorToken(e.target.value)}
                            maxLength={6}
                            pattern="[0-9]*"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            required
                          />
                        </div>
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-secondary hover:bg-secondary/90 text-white shadow-glow" 
                        disabled={verifyTwoFactorMutation.isPending || twoFactorToken.length !== 6}
                      >
                        {verifyTwoFactorMutation.isPending ? "Verifying..." : "Verify Code"}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            className="pl-10 bg-[#1E293B]/50 border-primary"
                            value={loginForm.username}
                            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 pr-10 bg-[#1E293B]/50 border-primary"
                            value={loginForm.password}
                            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 text-[#E5E5E5] hover:text-secondary"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="remember"
                            checked={rememberMe}
                            onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                          />
                          <Label
                            htmlFor="remember"
                            className="text-sm font-normal text-[#E5E5E5]"
                          >
                            Remember this device
                          </Label>
                        </div>
                        <Button variant="link" className="text-secondary p-0 h-auto">
                          Forgot password?
                        </Button>
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-secondary hover:bg-secondary/90 text-white shadow-glow" 
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? "Signing in..." : "Sign In"}
                      </Button>
                    </form>
                  )}
                </TabsContent>
                
                <TabsContent value="register">
                  {showTwoFactorSetup && twoFactorSetupData ? (
                    <div className="space-y-6">
                      <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20 text-center">
                        <Shield className="h-12 w-12 text-secondary mx-auto mb-2" />
                        <h3 className="text-lg font-semibold text-white mb-1">Two-Factor Authentication Setup</h3>
                        <p className="text-[#E5E5E5] text-sm mb-3">
                          Scan the QR code with your authenticator app to enable two-factor authentication for your account.
                        </p>
                        
                        <div className="bg-white rounded-lg p-4 inline-block mb-4">
                          <img src={twoFactorSetupData.qrCode} alt="QR Code" className="mx-auto w-48 h-48" />
                        </div>
                        
                        <div className="mb-4">
                          <form onSubmit={handle2FASetupVerify} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="setupToken">Verification Code</Label>
                              <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
                                <Input
                                  id="setupToken"
                                  type="text"
                                  placeholder="123456"
                                  className="pl-10 bg-[#1E293B]/50 border-primary text-center font-mono text-lg tracking-widest"
                                  value={setupToken}
                                  onChange={(e) => setSetupToken(e.target.value)}
                                  maxLength={6}
                                  pattern="[0-9]*"
                                  inputMode="numeric"
                                  required
                                />
                              </div>
                            </div>
                            
                            <Button 
                              type="submit" 
                              className="w-full bg-secondary hover:bg-secondary/90 text-white shadow-glow" 
                              disabled={verifyTwoFactorSetupMutation.isPending || setupToken.length !== 6}
                            >
                              {verifyTwoFactorSetupMutation.isPending ? "Verifying..." : "Verify and Enable 2FA"}
                            </Button>
                          </form>
                        </div>
                        
                        <div className="space-y-2 text-left">
                          <h4 className="font-semibold text-white">Recovery Keys</h4>
                          <p className="text-xs text-[#E5E5E5]">
                            Store these recovery keys in a safe place. You will need them if you lose access to your authenticator app.
                          </p>
                          <div className="bg-[#0F172A] rounded-md p-2 font-mono text-xs">
                            {twoFactorSetupData.recoveryCodes.map((key: string, idx: number) => (
                              <div key={idx} className="flex items-center py-1 border-b border-[#1E293B] last:border-0">
                                <span className="text-gray-500 mr-2 w-6">{idx + 1}.</span>
                                <span className="text-[#E5E5E5]">{key}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
                          <Input
                            id="fullName"
                            type="text"
                            placeholder="John Doe"
                            className="pl-10 bg-[#1E293B]/50 border-primary"
                            value={registerForm.fullName}
                            onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="regEmail">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
                          <Input
                            id="regEmail"
                            type="email"
                            placeholder="your@email.com"
                            className="pl-10 bg-[#1E293B]/50 border-primary"
                            value={registerForm.username}
                            onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="regPassword">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
                          <Input
                            id="regPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 pr-10 bg-[#1E293B]/50 border-primary"
                            value={registerForm.password}
                            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 text-[#E5E5E5] hover:text-secondary"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {registerForm.password && (
                          <div className="space-y-1 mt-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Password Strength</Label>
                              <span className="text-xs">
                                {passwordStrength < 30 && "Weak"}
                                {passwordStrength >= 30 && passwordStrength < 60 && "Moderate"}
                                {passwordStrength >= 60 && passwordStrength < 80 && "Strong"}
                                {passwordStrength >= 80 && "Very Strong"}
                              </span>
                            </div>
                            <Progress value={passwordStrength} className="h-1" 
                              indicator={`${getPasswordStrengthColor()} transition-all duration-500`} />
                            <ul className="text-xs space-y-1 mt-2 text-[#E5E5E5]/80">
                              <li className={`flex items-center ${/[A-Z]/.test(registerForm.password) ? 'text-green-400' : ''}`}>
                                <div className="w-3 h-3 mr-2 rounded-full border border-current flex items-center justify-center">
                                  {/[A-Z]/.test(registerForm.password) && "✓"}
                                </div>
                                Uppercase letter
                              </li>
                              <li className={`flex items-center ${/[a-z]/.test(registerForm.password) ? 'text-green-400' : ''}`}>
                                <div className="w-3 h-3 mr-2 rounded-full border border-current flex items-center justify-center">
                                  {/[a-z]/.test(registerForm.password) && "✓"}
                                </div>
                                Lowercase letter
                              </li>
                              <li className={`flex items-center ${/[0-9]/.test(registerForm.password) ? 'text-green-400' : ''}`}>
                                <div className="w-3 h-3 mr-2 rounded-full border border-current flex items-center justify-center">
                                  {/[0-9]/.test(registerForm.password) && "✓"}
                                </div>
                                Number
                              </li>
                              <li className={`flex items-center ${/[^A-Za-z0-9]/.test(registerForm.password) ? 'text-green-400' : ''}`}>
                                <div className="w-3 h-3 mr-2 rounded-full border border-current flex items-center justify-center">
                                  {/[^A-Za-z0-9]/.test(registerForm.password) && "✓"}
                                </div>
                                Special character
                              </li>
                              <li className={`flex items-center ${registerForm.password.length >= 8 ? 'text-green-400' : ''}`}>
                                <div className="w-3 h-3 mr-2 rounded-full border border-current flex items-center justify-center">
                                  {registerForm.password.length >= 8 && "✓"}
                                </div>
                                At least 8 characters
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enableTwoFactor"
                          checked={registerForm.twoFactorEnabled}
                          onCheckedChange={(checked) => 
                            setRegisterForm({ ...registerForm, twoFactorEnabled: Boolean(checked) })
                          }
                        />
                        <Label
                          htmlFor="enableTwoFactor"
                          className="text-sm font-normal text-[#E5E5E5]"
                        >
                          Enable two-factor authentication
                        </Label>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-xs text-[#E5E5E5]">
                          By registering, you agree to our Terms of Service and Privacy Policy.
                        </p>
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-secondary hover:bg-secondary/90 text-white shadow-glow" 
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Creating account..." : "Create Account"}
                      </Button>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-center w-full text-[#E5E5E5]">
                {formTab === "login" ? (
                  <>
                    Don't have an account?{" "}
                    <Button variant="link" className="text-secondary p-0 h-auto" onClick={() => setFormTab("register")}>
                      Sign up
                    </Button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <Button variant="link" className="text-secondary p-0 h-auto" onClick={() => setFormTab("login")}>
                      Sign in
                    </Button>
                  </>
                )}
              </p>
            </CardFooter>
          </Card>
        </div>
        
        {/* Hero Section */}
        <div className="hidden lg:block">
          <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <svg className="w-24 h-24 text-secondary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 10H5C3.89543 10 3 10.8954 3 12V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V12C21 10.8954 20.1046 10 19 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 10V8C17 5.23858 14.7614 3 12 3C9.23858 3 7 5.23858 7 8V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 16.5V18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="16" r="2" fill="currentColor"/>
              </svg>
              <h2 className="text-3xl font-bold text-white text-center">
                Your Life's Critical Information
              </h2>
              <p className="text-xl text-[#E5E5E5] text-center max-w-md">
                Securely stored and accessible when needed most.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-primary/30 backdrop-blur-md rounded-xl p-6 shadow-neumorphic">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-secondary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Military-Grade Encryption</h3>
                    <p className="text-[#E5E5E5]">
                      Your data is protected with AES-256 encryption, the same standard used by governments worldwide.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-primary/30 backdrop-blur-md rounded-xl p-6 shadow-neumorphic">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-secondary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M23 21V19C22.9986 17.1771 21.765 15.5857 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 3.13C17.7699 3.58317 19.0078 5.17735 19.0078 7.005C19.0078 8.83265 17.7699 10.4268 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Trusted Contacts</h3>
                    <p className="text-[#E5E5E5]">
                      Designate trusted individuals who can access your information in emergencies with configurable delays.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-primary/30 backdrop-blur-md rounded-xl p-6 shadow-neumorphic">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-secondary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Access Control</h3>
                    <p className="text-[#E5E5E5]">
                      Set time-based access rules and approval requirements for each piece of sensitive information.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
