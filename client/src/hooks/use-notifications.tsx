import { createContext, ReactNode, useContext, useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Notification } from '@/lib/types';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  refreshNotifications: () => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  // Fetch notifications
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch
  } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', lastRefreshed],
    enabled: !!user,
  });

  // Fetch unread count
  const { 
    data: unreadCountData = { count: 0 },
  } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count', lastRefreshed],
    enabled: !!user,
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/notifications/${id}/mark-read`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    }
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/notifications/mark-all-read');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    }
  });

  // Set up refresh interval (every 30 seconds)
  useEffect(() => {
    if (!user) return;
    
    const intervalId = setInterval(() => {
      refreshNotifications();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [user]);

  const refreshNotifications = () => {
    setLastRefreshed(Date.now());
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount: unreadCountData.count || 0,
        isLoading,
        error,
        markAsRead: (id) => markAsReadMutation.mutate(id),
        markAllAsRead: () => markAllAsReadMutation.mutate(),
        refreshNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}