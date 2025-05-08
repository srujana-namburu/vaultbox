import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { NotificationPreference } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

const notificationSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  emailFrequency: z.enum(['immediate', 'daily', 'weekly']),
  securityAlertsEnabled: z.boolean(),
  activityAlertsEnabled: z.boolean(),
  updatesEnabled: z.boolean()
});

type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>;

export default function NotificationSettings() {
  const { toast } = useToast();
  
  const { 
    data: preferences, 
    isLoading: isLoadingPreferences,
    error 
  } = useQuery<NotificationPreference>({
    queryKey: ['/api/notification-preferences'],
  });
  
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: NotificationSettingsFormValues) => {
      const res = await apiRequest('PUT', '/api/notification-preferences', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences'] });
      toast({
        title: 'Notification preferences updated',
        description: 'Your notification preferences have been saved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update preferences',
        description: error.message || 'An error occurred while saving your preferences.',
        variant: 'destructive',
      });
    },
  });
  
  const form = useForm<NotificationSettingsFormValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: preferences ? {
      emailEnabled: preferences.emailEnabled,
      pushEnabled: preferences.pushEnabled,
      inAppEnabled: preferences.inAppEnabled,
      emailFrequency: preferences.emailFrequency as 'immediate' | 'daily' | 'weekly',
      securityAlertsEnabled: preferences.securityAlertsEnabled,
      activityAlertsEnabled: preferences.activityAlertsEnabled,
      updatesEnabled: preferences.updatesEnabled,
    } : {
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      emailFrequency: 'immediate',
      securityAlertsEnabled: true,
      activityAlertsEnabled: true,
      updatesEnabled: true,
    },
  });
  
  // Update form values when preferences are loaded
  React.useEffect(() => {
    if (preferences) {
      form.reset({
        emailEnabled: preferences.emailEnabled,
        pushEnabled: preferences.pushEnabled,
        inAppEnabled: preferences.inAppEnabled,
        emailFrequency: preferences.emailFrequency as 'immediate' | 'daily' | 'weekly',
        securityAlertsEnabled: preferences.securityAlertsEnabled,
        activityAlertsEnabled: preferences.activityAlertsEnabled,
        updatesEnabled: preferences.updatesEnabled,
      });
    }
  }, [preferences, form]);
  
  function onSubmit(data: NotificationSettingsFormValues) {
    updatePreferencesMutation.mutate(data);
  }
  
  if (isLoadingPreferences) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <h2 className="text-xl font-semibold mb-2">Error loading notification preferences</h2>
        <p className="text-muted-foreground mb-4">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
        <Button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences'] })}
        >
          Try Again
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container py-10 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>
      <p className="text-muted-foreground mb-8">
        Customize how and when you receive notifications from VaultBox
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Preferences</CardTitle>
              <CardDescription>
                Choose how you'd like to receive notifications from VaultBox
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="inAppEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
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
              
              <FormField
                control={form.control}
                name="emailEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
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
              
              {form.watch('emailEnabled') && (
                <FormField
                  control={form.control}
                  name="emailFrequency"
                  render={({ field }) => (
                    <FormItem className="rounded-lg border p-4">
                      <FormLabel>Email Frequency</FormLabel>
                      <FormDescription>
                        Choose how often you'd like to receive email notifications
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-3 gap-4 pt-2"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="immediate" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Immediate
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="daily" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Daily Digest
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="weekly" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Weekly Digest
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="pushEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Push Notifications</FormLabel>
                      <FormDescription>
                        Receive push notifications on your device
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
            </CardContent>
            
            <Separator />
            
            <CardHeader>
              <CardTitle>Notification Types</CardTitle>
              <CardDescription>
                Choose which types of notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="securityAlertsEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Security Alerts</FormLabel>
                      <FormDescription>
                        Login attempts, security settings changes, and other security events
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
                control={form.control}
                name="activityAlertsEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Activity Alerts</FormLabel>
                      <FormDescription>
                        Vault entry updates, trusted contact changes, and other activity
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
                control={form.control}
                name="updatesEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">System Updates</FormLabel>
                      <FormDescription>
                        New features, maintenance notifications, and system updates
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
            </CardContent>
            
            <CardFooter>
              <Button 
                type="submit" 
                disabled={updatePreferencesMutation.isPending || !form.formState.isDirty}
                className="ml-auto"
              >
                {updatePreferencesMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}