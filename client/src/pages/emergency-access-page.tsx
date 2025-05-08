import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { EmergencyAccessPortal } from '@/components/emergency-access/emergency-access-portal';
import { Lock, Shield, AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function EmergencyAccessPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [contactId, setContactId] = useState<number | null>(null);
  
  // Parse the access token from the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const reqId = params.get('requestId');
    const contId = params.get('contactId');
    
    if (token && reqId && contId) {
      setAccessToken(token);
      setRequestId(parseInt(reqId, 10));
      setContactId(parseInt(contId, 10));
    } else {
      // No token, redirect to emergency request page
      toast({
        title: 'Invalid access link',
        description: 'The emergency access link is invalid or expired.',
        variant: 'destructive',
      });
      setLocation('/emergency-request');
    }
  }, [setLocation, toast]);
  
  // Verify the access token
  const { 
    data: isValidToken, 
    isLoading: isValidating,
    error: validationError
  } = useQuery<{ valid: boolean; message?: string }>({
    queryKey: ['/api/emergency-access/verify', accessToken],
    enabled: !!accessToken,
    retry: false,
    queryFn: async () => {
      if (!accessToken || !requestId || !contactId) {
        throw new Error('Missing required parameters');
      }
      
      const res = await apiRequest('POST', '/api/emergency-access/verify', { 
        token: accessToken,
        requestId,
        contactId
      });
      return res.json();
    }
  });
  
  // Show loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center bg-primary/20 p-3 rounded-full mb-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Verifying access...</h1>
          <p className="text-[#94A3B8] mt-2 max-w-md mx-auto">
            Please wait while we verify your emergency access credentials.
          </p>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (validationError || (isValidToken && !isValidToken.valid)) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center bg-red-500/20 p-3 rounded-full mb-4">
              <Lock className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
            <p className="text-[#94A3B8] mt-2">
              {isValidToken?.message || 'Your emergency access link is invalid or has expired.'}
            </p>
          </div>
          
          <Alert className="bg-red-900/20 border-red-800 text-red-100 mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Invalid Access</AlertTitle>
            <AlertDescription>
              If you believe this is a mistake, please contact the vault owner or submit a new emergency access request.
            </AlertDescription>
          </Alert>
          
          <Button 
            className="w-full" 
            onClick={() => setLocation('/emergency-request')}
          >
            Submit New Request
          </Button>
        </div>
      </div>
    );
  }
  
  // Valid access, show the emergency access portal
  if (isValidToken?.valid && requestId && contactId) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-2xl font-bold tracking-tight">VaultBox Emergency Access</h1>
            </div>
            <Button 
              variant="ghost" 
              className="text-[#94A3B8] hover:text-white"
              onClick={() => setLocation('/emergency-request')}
            >
              Exit
            </Button>
          </header>
          
          <main>
            <EmergencyAccessPortal accessRequestId={requestId} contactId={contactId} />
          </main>
          
          <footer className="mt-10 text-center text-sm text-[#94A3B8]">
            <p>VaultBox &copy; {new Date().getFullYear()} | Secure Personal Vault Application</p>
            <p className="mt-1">All emergency access actions are logged and audited for security purposes</p>
          </footer>
        </div>
      </div>
    );
  }
  
  // Fallback UI (should not reach here)
  return null;
}