import React from 'react';
import { Link } from 'wouter';
import { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/hooks/use-notifications';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Lock,
  AlertCircle,
  FileEdit,
  Users,
  Activity,
  Bell,
  Info,
  ExternalLink,
  Radio
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: Notification;
  showActions?: boolean;
}

export function NotificationItem({ notification, showActions = true }: NotificationItemProps) {
  const { markAsRead } = useNotifications();
  
  const timeSince = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true
  });

  // Get icon based on notification type
  const getNotificationIcon = (type: string) => {
    if (type.startsWith('security_')) return <Shield className="h-5 w-5 text-red-500" />;
    if (type.includes('login_')) return <Lock className="h-5 w-5 text-yellow-500" />;
    if (type.includes('emergency_')) return <AlertCircle className="h-5 w-5 text-orange-500" />;
    if (type.startsWith('entry_')) return <FileEdit className="h-5 w-5 text-blue-500" />;
    if (type.startsWith('contact_')) return <Users className="h-5 w-5 text-green-500" />;
    if (type.startsWith('activity_')) return <Activity className="h-5 w-5 text-purple-500" />;
    return <Bell className="h-5 w-5 text-gray-500" />;
  };

  // Get priority styling
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-l-4 border-red-500';
      case 'high':
        return 'border-l-4 border-orange-500';
      case 'medium':
        return 'border-l-4 border-yellow-500';
      case 'low':
      default:
        return '';
    }
  };

  return (
    <div 
      className={cn(
        "flex p-4 hover:bg-muted/50 transition-colors relative",
        notification.isRead ? 'opacity-75' : 'bg-muted/20',
        getPriorityStyle(notification.priority)
      )}
    >
      {!notification.isRead && (
        <Radio className="h-2 w-2 absolute top-4 right-4 text-blue-500 fill-blue-500" />
      )}
      
      <div className="flex-shrink-0 mr-3">
        {getNotificationIcon(notification.type)}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h5 className={cn(
            "text-sm font-medium line-clamp-1",
            !notification.isRead && "font-semibold"
          )}>
            {notification.title}
          </h5>
        </div>
        
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {notification.message}
        </p>
        
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{timeSince}</span>
          
          {showActions && (
            <div className="flex items-center gap-2">
              {notification.actionUrl && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  asChild
                >
                  <Link to={notification.actionUrl}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Link>
                </Button>
              )}
              
              {!notification.isRead && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => markAsRead(notification.id)}
                >
                  Mark read
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}