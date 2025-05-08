import { createContext, ReactNode, useContext, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { storeMasterKey, clearMasterKey, deriveKeyFromPassword } from "@/lib/encryption";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser | { requiresTwoFactor: boolean; userId: number }, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, RegisterData>;
  verifyTwoFactorMutation: UseMutationResult<SelectUser, Error, TwoFactorData>;
  setupTwoFactorMutation: UseMutationResult<TwoFactorSetupResult, Error, void>;
  securityScoreMutation: UseMutationResult<SelectUser, Error, { score: number }>;
  requires2FA: boolean;
  userId2FA: number | null;
  twoFactorSetupData: TwoFactorSetupResult | null;
  formatLastLogin: (date: Date | null | undefined) => string;
  calculatePasswordStrength: (password: string) => number;
};

type LoginData = {
  username: string;
  password: string;
  twoFactorToken?: string;
};

type TwoFactorData = {
  userId: number;
  twoFactorToken: string;
};

type TwoFactorSetupResult = {
  secret: string;
  qrCode: string;
  recoveryCodes: string[];
};

type RegisterData = {
  username: string;
  email: string;
  password: string;
  fullName: string;
  twoFactorEnabled?: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [requires2FA, setRequires2FA] = useState(false);
  const [userId2FA, setUserId2FA] = useState<number | null>(null);
  const [twoFactorSetupData, setTwoFactorSetupData] = useState<TwoFactorSetupResult | null>(null);
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (response: SelectUser | { requiresTwoFactor: boolean; userId: number }) => {
      // Check if the response indicates 2FA is required
      if ('requiresTwoFactor' in response && response.requiresTwoFactor) {
        setRequires2FA(true);
        setUserId2FA(response.userId);
        toast({
          title: "Two-factor authentication required",
          description: "Please enter your two-factor code to continue.",
        });
        return;
      }

      // Regular login success - clear 2FA state if it was set
      if (requires2FA) {
        setRequires2FA(false);
        setUserId2FA(null);
      }

      // Store user in query cache
      queryClient.setQueryData(["/api/user"], response);
      
      // Generate and store encryption key based on password
      const passwordInput = (document.getElementById('password') as HTMLInputElement)?.value;
      if (passwordInput) {
        deriveKeyFromPassword(passwordInput)
          .then(key => {
            storeMasterKey(key);
          });
      }

      toast({
        title: "Login successful",
        description: "Welcome back to VaultBox!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyTwoFactorMutation = useMutation({
    mutationFn: async (data: TwoFactorData) => {
      const res = await apiRequest("POST", "/api/verify-2fa", data);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      // Clear 2FA state
      setRequires2FA(false);
      setUserId2FA(null);
      
      // Set user in query cache
      queryClient.setQueryData(["/api/user"], user);
      
      toast({
        title: "Verification successful",
        description: "Two-factor authentication verified successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setupTwoFactorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/setup-2fa");
      return await res.json();
    },
    onSuccess: (data: TwoFactorSetupResult) => {
      setTwoFactorSetupData(data);
      toast({
        title: "2FA setup ready",
        description: "Scan the QR code with your authenticator app.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Setup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const securityScoreMutation = useMutation({
    mutationFn: async (data: { score: number }) => {
      const res = await apiRequest("POST", "/api/update-security-score", data);
      return await res.json();
    },
    onSuccess: (updatedUser: SelectUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      
      // Generate and store encryption key based on password
      const passwordInput = (document.getElementById('password') as HTMLInputElement)?.value;
      if (passwordInput) {
        deriveKeyFromPassword(passwordInput)
          .then(key => {
            storeMasterKey(key);
          });
      }
      
      toast({
        title: "Registration successful",
        description: "Welcome to VaultBox!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      
      // Clear master key when logging out
      clearMasterKey();
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const formatLastLogin = (date: Date | null | undefined): string => {
    if (!date) return "Never";
    
    try {
      // Convert string to Date object if needed
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format(dateObj, "MMMM d, yyyy 'at' h:mm a");
    } catch (error) {
      return "Invalid date";
    }
  };
  
  const calculatePasswordStrength = (password: string): number => {
    if (!password) return 0;
    
    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    
    // Complexity checks
    if (/[A-Z]/.test(password)) score += 15; // uppercase
    if (/[a-z]/.test(password)) score += 15; // lowercase
    if (/[0-9]/.test(password)) score += 15; // numbers
    if (/[^A-Za-z0-9]/.test(password)) score += 15; // special chars
    
    // Variety check
    const variety = (password.match(/[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || [])
      .filter((char, index, self) => self.indexOf(char) === index).length;
    score += Math.min(variety, 10);
    
    return Math.min(score, 100);
  };

  // Create the auth context value with all required properties
  const contextValue: AuthContextType = {
    user: user ?? null,
    isLoading,
    error,
    loginMutation,
    logoutMutation,
    registerMutation,
    verifyTwoFactorMutation,
    setupTwoFactorMutation,
    securityScoreMutation,
    requires2FA,
    userId2FA,
    twoFactorSetupData,
    formatLastLogin,
    calculatePasswordStrength
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
