import { createContext, ReactNode, useContext, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Notification, WebSocketMessage } from '@/lib/types';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // WebSocket connection for real-time notifications
  useEffect(() => {
    // Only connect if we have a user
    if (!user) return;
    
    // Connect to WebSocket server
    const connectWebSocket = () => {
      try {
        // Clean up any existing connection
        if (socketRef.current) {
          socketRef.current.close();
        }
        
        // Determine WebSocket protocol (ws or wss)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}`;
        
        // Create new WebSocket connection
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        
        // Connection opened
        socket.addEventListener('open', () => {
          console.log('WebSocket connection established');
          
          // Clear any reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        });
        
        // Handle messages
        socket.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            
            // Handle different message types
            switch(message.type) {
              case 'notification':
                // Show toast for new notification
                toast({
                  title: message.data.title,
                  description: message.data.message,
                  variant: message.data.priority === 'critical' ? 'destructive' : 'default',
                  duration: message.data.priority === 'critical' ? 10000 : 5000
                });
                
                // Refresh notification data
                refreshNotifications();
                break;
                
              case 'ping':
                // Respond to ping with pong to keep connection alive
                socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
              
              case 'system':
                console.log('System message:', message.message);
                break;
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        });
        
        // Handle errors
        socket.addEventListener('error', (error) => {
          console.error('WebSocket error:', error);
        });
        
        // Handle disconnection
        socket.addEventListener('close', (event) => {
          console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
          
          // Attempt to reconnect after delay
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            connectWebSocket();
          }, 5000);
        });
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
      }
    };
    
    // Initial connection
    connectWebSocket();
    
    // Clean up on unmount
    return () => {
      // Close WebSocket connection
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      
      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [user, toast]);

  // Additional polling as fallback (every 60 seconds)
  useEffect(() => {
    if (!user) return;
    
    const intervalId = setInterval(() => {
      refreshNotifications();
    }, 60000);
    
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