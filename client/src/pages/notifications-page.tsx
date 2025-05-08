import React, { useState } from 'react';
import { Link } from 'wouter';
import { useNotifications } from '@/hooks/use-notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  CheckCheck,
  Loader2, 
  Trash2, 
  Bell, 
  AlertCircle, 
  Settings 
} from 'lucide-react';

export default function NotificationsPage() {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    error, 
    markAllAsRead, 
    markAsRead 
  } = useNotifications();
  
  const [filter, setFilter] = useState('all');
  
  // Get filtered notifications
  const getFilteredNotifications = () => {
    if (filter === 'unread') {
      return notifications.filter(n => !n.isRead);
    }
    
    if (filter === 'security') {
      return notifications.filter(n => 
        n.type.startsWith('security_') || 
        n.type.includes('login_') || 
        n.type.includes('access_')
      );
    }
    
    if (filter === 'activity') {
      return notifications.filter(n => 
        n.type.startsWith('entry_') || 
        n.type.startsWith('contact_')
      );
    }
    
    if (filter === 'critical') {
      return notifications.filter(n => 
        n.priority === 'critical' || n.priority === 'high'
      );
    }
    
    return notifications;
  };
  
  const filteredNotifications = getFilteredNotifications();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error loading notifications</h2>
        <p className="text-muted-foreground mb-6">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }
  
  return (
    <div className="container py-10 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Stay updated on important security and activity alerts
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            disabled={unreadCount === 0}
            onClick={() => markAllAsRead()}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
          
          <Button variant="outline" size="sm" asChild>
            <Link to="/notification-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar with notification stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Filter</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter notifications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All notifications</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="activity">Activity</SelectItem>
                  <SelectItem value="critical">Critical / High priority</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Summary</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Total</span>
                  <span className="font-medium">{notifications.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Unread</span>
                  <span className="font-medium">{unreadCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Critical</span>
                  <span className="font-medium">
                    {notifications.filter(n => n.priority === 'critical').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main notification list */}
        <div className="md:col-span-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-card border rounded-lg p-8 text-center">
              <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">No notifications</h3>
              <p className="text-muted-foreground mb-6">
                You don't have any {filter !== 'all' ? filter + ' ' : ''}notifications at the moment
              </p>
              {filter !== 'all' && (
                <Button variant="outline" onClick={() => setFilter('all')}>
                  View all notifications
                </Button>
              )}
            </div>
          ) : (
            <Card>
              <div className="divide-y">
                {filteredNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}