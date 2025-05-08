import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Clock, Eye, Download, File, Lock, Search, Shield } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { VaultEntry, AccessRequest } from '@/lib/types';

interface EmergencyAccessPortalProps {
  accessRequestId: number;
  contactId: number;
}

export function EmergencyAccessPortal({ accessRequestId, contactId }: EmergencyAccessPortalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<VaultEntry | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  
  // Fetch access request details
  const { 
    data: accessRequest,
    isLoading: isLoadingRequest,
    error: requestError 
  } = useQuery<AccessRequest>({
    queryKey: ['/api/emergency-requests', accessRequestId],
    refetchInterval: 30000, // Refetch every 30 seconds to check for changes
  });
  
  // Fetch available vault entries
  const {
    data: vaultEntries,
    isLoading: isLoadingEntries,
    error: entriesError
  } = useQuery<VaultEntry[]>({
    queryKey: ['/api/emergency-access', accessRequestId],
    enabled: !!accessRequest && accessRequest.status === 'approved',
  });
  
  // Calculate time remaining for access
  const getTimeRemaining = () => {
    if (!accessRequest?.accessExpiresAt) return null;
    
    const now = new Date();
    const expiryTime = new Date(accessRequest.accessExpiresAt);
    const difference = expiryTime.getTime() - now.getTime();
    
    if (difference <= 0) return null;
    
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  };
  
  const timeRemaining = getTimeRemaining();
  
  // Filter entries by search query and category
  const filteredEntries = vaultEntries?.filter(entry => {
    const matchesSearch = searchQuery.trim() === '' || 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeTab === 'all' || entry.category === activeTab;
    
    return matchesSearch && matchesCategory;
  });
  
  // Get unique categories from entries
  const categories = vaultEntries 
    ? [...new Set(vaultEntries.map(entry => entry.category))]
    : [];
  
  // Handle view entry
  const handleViewEntry = (entry: VaultEntry) => {
    setSelectedEntry(entry);
  };
  
  // Handle download entry
  const handleDownloadEntry = async (entry: VaultEntry) => {
    try {
      const response = await apiRequest('GET', `/api/emergency-access/download/${entry.id}`);
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entry.title}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Entry downloaded',
        description: `${entry.title} has been saved to your device.`,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Could not download this entry.',
        variant: 'destructive',
      });
    }
  };
  
  // Render loading state
  if (isLoadingRequest) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full bg-[#334155]" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 bg-[#334155]" />
          ))}
        </div>
      </div>
    );
  }
  
  // Render error state
  if (requestError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          There was an error loading emergency access. Please try again.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Render denied state
  if (accessRequest && accessRequest.status === 'denied') {
    return (
      <Alert variant="destructive" className="bg-red-900/20 border-red-800 text-red-100">
        <Lock className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          Your emergency access request has been denied by the vault owner.
          {accessRequest.responseNote && (
            <div className="mt-2 p-2 rounded bg-red-950 text-red-100">
              <p className="text-sm font-medium">Note from vault owner:</p>
              <p className="text-sm italic">{accessRequest.responseNote}</p>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  
  // Render pending state
  if (accessRequest && accessRequest.status === 'pending') {
    return (
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="mr-2 h-5 w-5 text-amber-400" />
            Request Pending
          </CardTitle>
          <CardDescription>
            Your emergency access request is waiting for approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="bg-amber-900/20 border-amber-800 text-amber-100">
            <AlertTitle>Waiting for approval</AlertTitle>
            <AlertDescription>
              The vault owner has been notified of your request and needs to approve it.
              If they don't respond, access will be granted automatically on:
              {accessRequest.autoApproveAt && (
                <p className="font-medium mt-1">
                  {format(new Date(accessRequest.autoApproveAt), 'MMMM d, yyyy h:mm a')}
                </p>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  // Render for expired/invalid requests
  if (!accessRequest || (accessRequest && accessRequest.status !== 'approved')) {
    return (
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="mr-2 h-5 w-5 text-red-400" />
            No Active Access
          </CardTitle>
          <CardDescription>
            You don't have any active emergency access to this vault.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Access Expired or Invalid</AlertTitle>
            <AlertDescription>
              If you need emergency access, please submit a new request.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  // Main approved content
  return (
    <div className="space-y-6">
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="mr-2 h-6 w-6 text-green-400" />
              <div>
                <CardTitle>Emergency Access Portal</CardTitle>
                <CardDescription>
                  You have been granted emergency access to this vault
                </CardDescription>
              </div>
            </div>
            {timeRemaining && (
              <Badge variant="outline" className="text-amber-300 border-amber-500">
                <Clock className="mr-1 h-3 w-3" />
                Access expires in {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="bg-blue-900/20 border-blue-800 text-blue-100">
            <AlertTitle>Important Information</AlertTitle>
            <AlertDescription>
              You have read-only access to the vault entries shared for emergency situations.
              All of your actions in this portal are being logged.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      
      {isLoadingEntries ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 bg-[#334155]" />
          ))}
        </div>
      ) : entriesError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Could not load vault entries. Please refresh the page.
          </AlertDescription>
        </Alert>
      ) : vaultEntries && vaultEntries.length === 0 ? (
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader>
            <CardTitle>No Entries Available</CardTitle>
            <CardDescription>
              No vault entries have been shared for emergency access.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search entries..."
                className="pl-8 bg-[#0F172A] border-[#334155]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#0F172A]">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value={activeTab} className="pt-4">
              {filteredEntries && filteredEntries.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p>No entries found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredEntries?.map((entry) => (
                    <Card key={entry.id} className="bg-[#1E293B] border-[#334155] hover:border-primary transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{entry.title}</CardTitle>
                          <Badge variant="outline" className="capitalize">
                            {entry.category}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-1">
                          {entry.description || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="text-sm text-[#94A3B8] line-clamp-2">
                          {entry.notes || "No additional notes"}
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-[#334155] hover:bg-[#334155]"
                          onClick={() => handleViewEntry(entry)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-[#334155] hover:bg-[#334155]"
                          onClick={() => handleDownloadEntry(entry)}
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Export
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
      
      {/* Entry detail dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="bg-[#1E293B] border-[#334155] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEntry?.title}</DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              {selectedEntry?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-1">Category</h3>
              <Badge variant="outline" className="capitalize">
                {selectedEntry?.category}
              </Badge>
            </div>
            
            {selectedEntry?.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-1">Metadata</h3>
                <div className="rounded-md bg-[#0F172A] border border-[#334155] p-3 text-sm">
                  {Object.entries(selectedEntry.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between mb-1 last:mb-0">
                      <span className="text-[#94A3B8]">{key}:</span>
                      <span>{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {selectedEntry?.notes && (
              <div>
                <h3 className="text-sm font-medium mb-1">Notes</h3>
                <div className="rounded-md bg-[#0F172A] border border-[#334155] p-3">
                  <ScrollArea className="h-[200px] w-full">
                    <div className="text-sm whitespace-pre-wrap">{selectedEntry.notes}</div>
                  </ScrollArea>
                </div>
              </div>
            )}
            
            <Separator className="bg-[#334155]" />
            
            <div className="flex justify-between items-center text-sm text-[#94A3B8]">
              <div>
                <p>Created: {selectedEntry?.createdAt && format(new Date(selectedEntry.createdAt), 'MMM d, yyyy')}</p>
                <p>Last updated: {selectedEntry?.updatedAt && format(new Date(selectedEntry.updatedAt), 'MMM d, yyyy')}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-[#334155] hover:bg-[#334155]"
                onClick={() => selectedEntry && handleDownloadEntry(selectedEntry)}
              >
                <Download className="mr-1 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}