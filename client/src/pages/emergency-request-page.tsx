import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Shield, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import * as React from "react";
import { cn } from "@/lib/utils";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

// Schema for the emergency access request form
const emergencyRequestSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  targetUserEmail: z.string().email({ message: 'Please enter a valid vault owner email address' }),
  reason: z.string().min(10, { message: 'Please provide a reason for the emergency access request (minimum 10 characters)' }).max(500, { message: 'Reason is too long (maximum 500 characters)' }),
  confirmEmergency: z.boolean().refine(val => val === true, {
    message: 'You must confirm this is an emergency request'
  })
});

type EmergencyRequestForm = z.infer<typeof emergencyRequestSchema>;

const CustomTextarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
CustomTextarea.displayName = "CustomTextarea";

export default function EmergencyRequestPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [autoApproveDate, setAutoApproveDate] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  
  const form = useForm<EmergencyRequestForm>({
    resolver: zodResolver(emergencyRequestSchema),
    defaultValues: {
      email: '',
      targetUserEmail: '',
      reason: '',
      confirmEmergency: false
    }
  });

  // Calculate time remaining until auto-approval
  const getTimeRemaining = () => {
    if (!autoApproveDate) return null;
    
    const now = new Date();
    const approveTime = new Date(autoApproveDate);
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

  const timeRemaining = getTimeRemaining();
  const progress = timeRemaining && autoApproveDate 
    ? Math.min(100, Math.max(0, (new Date().getTime() - new Date().getTime()) / 
      (new Date(autoApproveDate).getTime() - new Date().getTime()) * 100))
    : 0;

  const onSubmit = async (data: EmergencyRequestForm) => {
    setIsSubmitting(true);
    
    try {
      const response = await apiRequest('POST', '/api/emergency-access-request', {
        email: data.email,
        targetUserEmail: data.targetUserEmail,
        reason: data.reason
      });
      
      const result = await response.json();
      
      setRequestSubmitted(true);
      setAutoApproveDate(result.autoApproveAt);
      setRequestId(result.requestId);
      
      toast({
        title: 'Emergency request submitted',
        description: 'The vault owner has been notified of your request.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Request failed',
        description: error instanceof Error ? error.message : 'Failed to submit emergency access request',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-primary/20 p-3 rounded-full mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">VaultBox Emergency Access</h1>
          <p className="text-[#94A3B8] mt-2 max-w-2xl mx-auto">
            This secure portal allows trusted contacts to request emergency access to a vault in case of an emergency.
          </p>
        </div>

        {!requestSubmitted ? (
          <Card className="bg-[#1E293B] border-[#334155]">
            <CardHeader>
              <CardTitle>Request Emergency Access</CardTitle>
              <CardDescription className="text-[#94A3B8]">
                This request will be sent to the vault owner for approval. After a waiting period, 
                you may be granted access automatically if the owner doesn't respond.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 bg-amber-900/20 border-amber-800 text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important Notice</AlertTitle>
                <AlertDescription>
                  Emergency access requests are logged and audited. Only use this feature for genuine emergencies when the vault owner is unable to provide access.
                </AlertDescription>
              </Alert>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Email Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="your.email@example.com"
                              className="bg-[#0F172A] border-[#334155]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[#94A3B8]">
                            Must match the email registered as a trusted contact
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="targetUserEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vault Owner Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="vaultowner@example.com"
                              className="bg-[#0F172A] border-[#334155]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[#94A3B8]">
                            Email address of the vault owner
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason for Emergency Access</FormLabel>
                        <FormControl>
                          <CustomTextarea
                            placeholder="Please explain why you need emergency access to this vault..."
                            className="resize-none bg-[#0F172A] border-[#334155]"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-[#94A3B8]">
                          Provide a clear explanation for why you need emergency access
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Separator className="bg-[#334155]" />
                  
                  <FormField
                    control={form.control}
                    name="confirmEmergency"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I confirm this is an emergency request and I am authorized to access this vault
                          </FormLabel>
                          <FormDescription className="text-[#94A3B8]">
                            By checking this box, you acknowledge that this action is logged and audited
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Emergency Access Request
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#1E293B] border-[#334155]">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="bg-green-900/20 p-3 rounded-full">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </div>
              <CardTitle className="text-center">Emergency Request Submitted</CardTitle>
              <CardDescription className="text-[#94A3B8] text-center">
                Your request ID is #{requestId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-blue-900/20 border-blue-800 text-blue-300">
                <Clock className="h-4 w-4" />
                <AlertTitle>Waiting Period In Effect</AlertTitle>
                <AlertDescription>
                  The vault owner has been notified and can approve or deny your request. If there is no response, 
                  access will be automatically granted after the waiting period.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94A3B8]">Auto-approval timer:</span>
                  <span className="text-sm font-medium">
                    {timeRemaining ? `${timeRemaining.days}d ${timeRemaining.hours}h ${timeRemaining.minutes}m remaining` : 'Calculating...'}
                  </span>
                </div>
                <Progress value={progress} className="h-2 bg-[#334155]" />
              </div>
              
              <div className="rounded-lg border border-[#334155] bg-[#0F172A] p-4">
                <h3 className="font-medium mb-2">What happens next?</h3>
                <ul className="space-y-2 text-sm text-[#94A3B8]">
                  <li className="flex items-start">
                    <span className="mr-2">1.</span>
                    <span>You'll receive an email notification when your request is approved or denied.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">2.</span>
                    <span>If approved, you'll receive a secure link to access the vault.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">3.</span>
                    <span>Your access will be limited to entries the vault owner has designated for emergency access.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">4.</span>
                    <span>All actions you take will be logged for security purposes.</span>
                  </li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full border-[#334155] hover:bg-[#334155] text-white"
                onClick={() => {
                  setRequestSubmitted(false);
                  setAutoApproveDate(null);
                  setRequestId(null);
                  form.reset();
                }}
              >
                Submit Another Request
              </Button>
            </CardFooter>
          </Card>
        )}
        
        <div className="text-center mt-8 text-sm text-[#94A3B8]">
          <p>VaultBox &copy; {new Date().getFullYear()} | Secure Personal Vault Application</p>
          <p className="mt-1">All emergency access requests are logged and audited for security purposes</p>
        </div>
      </div>
    </div>
  );
}