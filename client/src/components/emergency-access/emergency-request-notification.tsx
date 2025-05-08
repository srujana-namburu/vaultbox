import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, XCircle, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { format, formatDistance } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { AccessRequest, TrustedContact } from '@/lib/types';

type EmergencyRequestNotificationProps = {
  userId: number;
};

export function EmergencyRequestNotification({ userId }: EmergencyRequestNotificationProps) {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [isViewingRequest, setIsViewingRequest] = useState(false);
  const [isConfirmingAction, setIsConfirmingAction] = useState<'approve' | 'deny' | null>(null);
  
  // Fetch pending emergency access requests
  const { 
    data: pendingRequests,
    isLoading: isLoadingRequests,
    error: requestsError
  } = useQuery<AccessRequest[]>({
    queryKey: ['/api/emergency-requests/pending', userId],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Fetch trusted contacts to get names
  const { 
    data: trustedContacts
  } = useQuery<TrustedContact[]>({
    queryKey: ['/api/trusted-contacts'],
    enabled: pendingRequests !== undefined && pendingRequests.length > 0,
  });
  
  // Mutation for approving an emergency access request
  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('PUT', `/api/emergency-requests/${requestId}/approve`, { 
        note: responseNote
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Request approved',
        description: 'Emergency access has been granted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/emergency-requests/pending'] });
      setIsViewingRequest(false);
      setIsConfirmingAction(null);
      setSelectedRequest(null);
      setResponseNote('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to approve request',
        description: error.message,
        variant: 'destructive',
      });
      setIsConfirmingAction(null);
    }
  });
  
  // Mutation for denying an emergency access request
  const denyMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('PUT', `/api/emergency-requests/${requestId}/deny`, { 
        note: responseNote
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Request denied',
        description: 'Emergency access request has been denied.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/emergency-requests/pending'] });
      setIsViewingRequest(false);
      setIsConfirmingAction(null);
      setSelectedRequest(null);
      setResponseNote('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to deny request',
        description: error.message,
        variant: 'destructive',
      });
      setIsConfirmingAction(null);
    }
  });
  
  // Get contact name from contactId
  const getContactName = (contactId: number): string => {
    if (!trustedContacts) return 'Contact';
    const contact = trustedContacts.find(c => c.id === contactId);
    return contact ? contact.name : 'Contact';
  };
  
  // Calculate time remaining until auto-approval
  const getTimeRemaining = (date: string) => {
    const now = new Date();
    const approveTime = new Date(date);
    const difference = approveTime.getTime() - now.getTime();
    
    if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);
    
    return {
      days,
      hours,
      minutes,
      seconds,
      total: difference
    };
  };
  
  // Calculate progress percentage
  const calculateProgress = (autoApproveAt: string) => {
    const now = new Date();
    const requestDate = new Date(selectedRequest?.requestedAt || now);
    const approveDate = new Date(autoApproveAt);
    
    const totalTime = approveDate.getTime() - requestDate.getTime();
    const elapsedTime = now.getTime() - requestDate.getTime();
    
    return Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
  };
  
  // Render emergency request notification alert
  if (isLoadingRequests) {
    return null; // Don't show anything while loading
  }
  
  if (!pendingRequests || pendingRequests.length === 0) {
    return null; // Don't show anything if no requests
  }
  
  return (
    <>
      <Alert className="mb-6 border-red-800 bg-red-900/20 text-white">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <AlertTitle className="font-bold text-red-300">Emergency Access Requests</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-2">
            You have {pendingRequests.length} pending emergency access {pendingRequests.length === 1 ? 'request' : 'requests'} from your trusted {pendingRequests.length === 1 ? 'contact' : 'contacts'}.
          </p>
          
          <div className="space-y-2">
            {pendingRequests.map((request) => {
              const contactName = getContactName(request.contactId);
              const timeRemaining = getTimeRemaining(request.autoApproveAt);
              
              return (
                <div 
                  key={request.id} 
                  className="rounded-md bg-red-950/60 p-3 flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-medium text-red-200">{contactName}</h4>
                    <p className="text-sm text-red-300">
                      Requested {formatDistance(new Date(request.requestedAt), new Date(), { addSuffix: true })}
                    </p>
                    <div className="flex items-center mt-1">
                      <Clock className="h-3 w-3 text-red-400 mr-1" />
                      <p className="text-xs text-red-400">
                        Auto-approval in: {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-200 hover:text-white hover:bg-red-800"
                    onClick={() => {
                      setSelectedRequest(request);
                      setIsViewingRequest(true);
                    }}
                  >
                    View
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </AlertDescription>
      </Alert>
      
      {/* Request details dialog */}
      {selectedRequest && (
        <Dialog open={isViewingRequest} onOpenChange={setIsViewingRequest}>
          <DialogContent className="bg-[#1E293B] border-[#334155] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Emergency Access Request</DialogTitle>
              <DialogDescription className="text-[#94A3B8]">
                From {getContactName(selectedRequest.contactId)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Status:</span>
                  <Badge variant={
                    selectedRequest.status === 'pending' ? 'outline' : 
                    selectedRequest.status === 'approved' ? 'success' : 
                    selectedRequest.status === 'denied' ? 'destructive' : 'secondary'
                  }>
                    {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Requested:</span>
                  <span className="text-sm font-medium">
                    {format(new Date(selectedRequest.requestedAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                {selectedRequest.status === 'pending' && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Auto-approves:</span>
                    <span className="text-sm font-medium">
                      {format(new Date(selectedRequest.autoApproveAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                )}
              </div>
              
              {selectedRequest.status === 'pending' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-[#94A3B8]">
                    <span>Progress to auto-approval</span>
                    <span>
                      {Math.round(calculateProgress(selectedRequest.autoApproveAt))}%
                    </span>
                  </div>
                  <Progress 
                    value={calculateProgress(selectedRequest.autoApproveAt)} 
                    className="h-2 bg-[#334155]"
                  />
                </div>
              )}
              
              <Card className="bg-[#0F172A] border-[#334155]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Reason for Request</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#94A3B8]">{selectedRequest.reason}</p>
                </CardContent>
              </Card>
              
              {selectedRequest.status === 'pending' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Response Note (Optional)</label>
                  <Textarea 
                    value={responseNote}
                    onChange={(e) => setResponseNote(e.target.value)}
                    placeholder="Add a note to your response..."
                    className="bg-[#0F172A] border-[#334155] resize-none h-20"
                  />
                </div>
              )}
            </div>
            
            {selectedRequest.status === 'pending' && (
              <DialogFooter className="flex sm:justify-between gap-2">
                <Button 
                  variant="destructive" 
                  onClick={() => setIsConfirmingAction('deny')}
                  className="flex-1"
                >
                  Deny Access
                </Button>
                <Button 
                  variant="default"
                  onClick={() => setIsConfirmingAction('approve')}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Approve Access
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
      
      {/* Confirmation dialog for approve/deny actions */}
      <Dialog 
        open={isConfirmingAction !== null} 
        onOpenChange={() => setIsConfirmingAction(null)}
      >
        <DialogContent className="bg-[#1E293B] border-[#334155] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isConfirmingAction === 'approve' ? 'Confirm Approval' : 'Confirm Denial'}
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              {isConfirmingAction === 'approve' 
                ? 'You are granting emergency access to your vault.'
                : 'You are denying the emergency access request.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-center py-2">
            {isConfirmingAction === 'approve' ? (
              <CheckCircle className="h-16 w-16 text-green-500" />
            ) : (
              <XCircle className="h-16 w-16 text-red-500" />
            )}
          </div>
          
          <Alert className={
            isConfirmingAction === 'approve' 
              ? "bg-green-900/20 border-green-800 text-green-300"
              : "bg-red-900/20 border-red-800 text-red-300"
          }>
            <AlertTitle>Important Information</AlertTitle>
            <AlertDescription>
              {isConfirmingAction === 'approve' 
                ? "The contact will gain access to portions of your vault you've marked for emergency access. This action is logged and cannot be undone."
                : "The contact will be notified that their request was denied. They can submit a new request if needed."}
            </AlertDescription>
          </Alert>
          
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button 
              variant="outline" 
              className="flex-1 border-[#334155] hover:bg-[#334155] text-white"
              onClick={() => setIsConfirmingAction(null)}
            >
              Cancel
            </Button>
            <Button 
              variant={isConfirmingAction === 'approve' ? 'default' : 'destructive'}
              className={isConfirmingAction === 'approve' ? "flex-1 bg-green-600 hover:bg-green-700" : "flex-1"}
              onClick={() => {
                if (selectedRequest) {
                  if (isConfirmingAction === 'approve') {
                    approveMutation.mutate(selectedRequest.id);
                  } else {
                    denyMutation.mutate(selectedRequest.id);
                  }
                }
              }}
              disabled={approveMutation.isPending || denyMutation.isPending}
            >
              {(approveMutation.isPending || denyMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isConfirmingAction === 'approve' ? 'Approve Access' : 'Deny Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}