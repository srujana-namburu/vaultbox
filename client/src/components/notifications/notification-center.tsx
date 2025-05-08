import React, { useState } from 'react';
import { Bell, Check, XCircle } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationItem } from './notification-item';

export function NotificationCenter() {
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  // Get the unread notifications
  const unreadNotifications = notifications.filter(n => !n.isRead);
  
  // Get security notifications
  const securityNotifications = notifications.filter(n => 
    n.type.startsWith('security_') || n.type.includes('login_') || n.type.includes('access_')
  );
  
  // Get activity notifications
  const activityNotifications = notifications.filter(n => 
    n.type.startsWith('entry_') || n.type.startsWith('contact_')
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 px-1.5 min-w-[1.2rem] h-5"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4">
          <h4 className="font-medium text-lg">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsRead()}
              variant="ghost"
              size="sm"
              className="flex items-center text-xs"
            >
              <Check className="h-4 w-4 mr-1" />
              Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="all" className="text-xs">
              All
              {unreadCount > 0 && (
                <Badge variant="outline" className="ml-1">{unreadCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-[350px]">
            <TabsContent value="all" className="space-y-0 m-0">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <XCircle className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No notifications</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <NotificationItem 
                    key={notification.id} 
                    notification={notification} 
                  />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="security" className="space-y-0 m-0">
              {securityNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <XCircle className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No security notifications</p>
                </div>
              ) : (
                securityNotifications.map(notification => (
                  <NotificationItem 
                    key={notification.id} 
                    notification={notification} 
                  />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="activity" className="space-y-0 m-0">
              {activityNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <XCircle className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No activity notifications</p>
                </div>
              ) : (
                activityNotifications.map(notification => (
                  <NotificationItem 
                    key={notification.id} 
                    notification={notification} 
                  />
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
        
        <Separator />
        <div className="p-2 text-center">
          <Button variant="link" size="sm" className="text-xs" asChild>
            <a href="/notifications">View all notifications</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}