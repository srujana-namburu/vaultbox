import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChevronRight, Activity, Clock, Users, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TrustedContact } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const trustedContactSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  relationship: z.enum(["family", "friend", "legal", "medical", "other"]),
  inactivityPeriod: z.number().min(1, { message: "Inactivity period must be at least 1 day" }),
  personalMessage: z.string().optional(),
  waitingPeriod: z.string()
});

type TrustedContactForm = z.infer<typeof trustedContactSchema>;

export default function TrustedContactPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Fetch the user's trusted contact
  const { 
    data: trustedContact, 
    isLoading: isLoadingContact, 
    error: contactError 
  } = useQuery<TrustedContact[]>({
    queryKey: ['/api/trusted-contacts'],
    enabled: !!user,
  });

  // Initialize the form 
  const form = useForm<TrustedContactForm>({
    resolver: zodResolver(trustedContactSchema),
    defaultValues: {
      name: "",
      email: "",
      relationship: "other",
      inactivityPeriod: 30,
      personalMessage: "",
      waitingPeriod: "24 hours"
    }
  });

  // Update form values if contact data is loaded
  useEffect(() => {
    if (trustedContact && trustedContact.length > 0) {
      const contact = trustedContact[0];
      form.reset({
        name: contact.name,
        email: contact.email,
        relationship: contact.relationship,
        inactivityPeriod: contact.inactivityPeriod,
        personalMessage: contact.personalMessage || "",
        waitingPeriod: contact.waitingPeriod
      });
    }
  }, [trustedContact, form]);

  // Mutation for adding/updating trusted contact
  const addContactMutation = useMutation({
    mutationFn: async (data: TrustedContactForm) => {
      if (trustedContact && trustedContact.length > 0) {
        const res = await apiRequest("PUT", `/api/trusted-contacts/${trustedContact[0].id}`, data);
        return await res.json();
      } else {
        const res = await apiRequest("POST", "/api/trusted-contacts", data);
        return await res.json();
      }
    },
    onSuccess: () => {
      toast({
        title: trustedContact && trustedContact.length > 0 ? "Contact updated" : "Contact added",
        description: "Your trusted contact has been successfully saved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trusted-contacts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for removing trusted contact
  const removeContactMutation = useMutation({
    mutationFn: async () => {
      if (trustedContact && trustedContact.length > 0) {
        await apiRequest("DELETE", `/api/trusted-contacts/${trustedContact[0].id}`);
      }
    },
    onSuccess: () => {
      toast({
        title: "Contact removed",
        description: "Your trusted contact has been removed."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trusted-contacts'] });
      form.reset({
        name: "",
        email: "",
        relationship: "other",
        inactivityPeriod: 30,
        personalMessage: "",
        waitingPeriod: "24 hours"
      });
      setIsRemoving(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsRemoving(false);
    }
  });

  // Reset inactivity timer
  const resetInactivityMutation = useMutation({
    mutationFn: async () => {
      if (trustedContact && trustedContact.length > 0) {
        const res = await apiRequest("POST", `/api/trusted-contacts/${trustedContact[0].id}/reset-inactivity`);
        return await res.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Timer reset",
        description: "Inactivity timer has been reset successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trusted-contacts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Form submission handler
  const onSubmit = (data: TrustedContactForm) => {
    addContactMutation.mutate(data);
  };

  // Calculate days since last reset
  const calculateDaysSinceReset = () => {
    if (!trustedContact || trustedContact.length === 0 || !trustedContact[0].lastInactivityResetDate) {
      return 0;
    }
    
    const lastReset = new Date(trustedContact[0].lastInactivityResetDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastReset.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // Calculate progress percentage
  const calculateProgress = () => {
    if (!trustedContact || trustedContact.length === 0) {
      return 0;
    }
    
    const daysSinceReset = calculateDaysSinceReset();
    const inactivityPeriod = trustedContact[0].inactivityPeriod;
    
    return Math.min(100, Math.round((daysSinceReset / inactivityPeriod) * 100));
  };

  const hasContact = trustedContact && trustedContact.length > 0;
  const daysSinceReset = calculateDaysSinceReset();
  const progressPercentage = calculateProgress();

  return (
    <div className="container py-8">
      <div className="flex flex-col space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Trusted Contact</h1>
        <p className="text-muted-foreground">
          Manage your emergency access trusted contact who can access your vault entries under specific conditions.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <Tabs defaultValue={hasContact ? "manage" : "add"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="add" disabled={addContactMutation.isPending}>
                {hasContact ? "Edit Contact" : "Add Contact"}
              </TabsTrigger>
              <TabsTrigger value="manage" disabled={!hasContact}>
                Manage Access
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="add" className="space-y-4 pt-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="contact@example.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            An invitation will be sent to this email.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relationship</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select relationship" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="family">Family</SelectItem>
                              <SelectItem value="friend">Friend</SelectItem>
                              <SelectItem value="legal">Legal Representative</SelectItem>
                              <SelectItem value="medical">Medical Professional</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="inactivityPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inactivity Period (days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Days of inactivity before emergency access is triggered.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="waitingPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Waiting Period</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select waiting period" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="24 hours">24 hours</SelectItem>
                            <SelectItem value="48 hours">48 hours</SelectItem>
                            <SelectItem value="3 days">3 days</SelectItem>
                            <SelectItem value="7 days">7 days</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Time your contact must wait after requesting emergency access.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="personalMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Message (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add a personal message for your trusted contact"
                            className="resize-none"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex items-center justify-between pt-4">
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={() => setIsRemoving(true)}
                      disabled={!hasContact || removeContactMutation.isPending}
                    >
                      {removeContactMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Remove Contact
                    </Button>
                    
                    <Button 
                      type="submit" 
                      disabled={addContactMutation.isPending}
                    >
                      {addContactMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {hasContact ? "Update Contact" : "Add Contact"}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="manage" className="space-y-4 pt-4">
              {hasContact ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Emergency Access Settings</CardTitle>
                      <CardDescription>
                        Configure how your trusted contact can access your vault in an emergency
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Inactivity Timer</div>
                          <div className="text-sm text-muted-foreground">
                            {daysSinceReset} of {trustedContact[0].inactivityPeriod} days
                          </div>
                        </div>
                        <Progress value={progressPercentage} className="h-2" />
                        <p className="text-sm text-muted-foreground">
                          {trustedContact[0].inactivityPeriod - daysSinceReset} days remaining before emergency access can be requested
                        </p>
                      </div>
                      
                      <Button 
                        onClick={() => resetInactivityMutation.mutate()} 
                        disabled={resetInactivityMutation.isPending}
                        variant="outline"
                        className="w-full"
                      >
                        {resetInactivityMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Reset Inactivity Timer
                      </Button>
                      
                      <Alert className={progressPercentage > 75 ? "border-destructive" : ""}>
                        <Activity className="h-4 w-4" />
                        <AlertTitle>
                          {progressPercentage > 75 ? "Warning: Approaching Inactivity Threshold" : "Inactivity Status"}
                        </AlertTitle>
                        <AlertDescription>
                          {progressPercentage > 75 
                            ? "Your account is approaching the inactivity threshold. Login regularly to reset the timer."
                            : "Your inactivity timer is active. Login regularly to prevent emergency access triggers."}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Waiting Period</CardTitle>
                      <CardDescription>
                        Time your contact must wait after requesting emergency access
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <span>{trustedContact[0].waitingPeriod}</span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => form.setFocus("waitingPeriod")}
                          className="text-xs"
                        >
                          Change
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No Trusted Contact</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Add a trusted contact first to manage emergency access settings.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle>What is a Trusted Contact?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                A trusted contact is someone you designate to access your vault entries in case of emergency.
              </p>
              
              <div className="space-y-2">
                <div className="flex items-start">
                  <ChevronRight className="h-5 w-5 mr-2 text-primary flex-shrink-0" />
                  <p className="text-sm">They can only access entries you've explicitly shared or after a period of inactivity.</p>
                </div>
                
                <div className="flex items-start">
                  <ChevronRight className="h-5 w-5 mr-2 text-primary flex-shrink-0" />
                  <p className="text-sm">The inactivity timer resets every time you log in to your account.</p>
                </div>
                
                <div className="flex items-start">
                  <ChevronRight className="h-5 w-5 mr-2 text-primary flex-shrink-0" />
                  <p className="text-sm">Your trusted contact must wait for a specified period after requesting access.</p>
                </div>
                
                <div className="flex items-start">
                  <ChevronRight className="h-5 w-5 mr-2 text-primary flex-shrink-0" />
                  <p className="text-sm">You'll receive notifications of any access requests or changes.</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="link"
                onClick={() => {
                  // Maybe link to more detailed documentation
                  toast({
                    title: "Information",
                    description: "Learn more about trusted contacts and how they work."
                  });
                }}
                className="px-0"
              >
                Learn more about trusted contacts
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog for Removing Contact */}
      <Dialog open={isRemoving} onOpenChange={setIsRemoving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Trusted Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this trusted contact? They will no longer have emergency access to your vault.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemoving(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => removeContactMutation.mutate()}
              disabled={removeContactMutation.isPending}
            >
              {removeContactMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}