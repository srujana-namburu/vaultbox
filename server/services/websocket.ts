import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { log } from '../vite';
import { Notification } from '@shared/schema';

interface ActiveConnection {
  userId: number;
  socket: WebSocket;
  lastPing?: number;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private activeConnections: Map<WebSocket, ActiveConnection> = new Map();
  
  /**
   * Initialize the WebSocket server
   */
  initialize(httpServer: Server) {
    // Create a WebSocket server using a different path than Vite's HMR
    this.wss = new WebSocketServer({ 
      server: httpServer, 
      path: '/ws',
      clientTracking: true
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    log('WebSocket server initialized', 'websocket');
    
    // Set up ping interval to keep connections alive and detect stale connections
    setInterval(this.pingConnections.bind(this), 30000);
  }
  
  /**
   * Handle new WebSocket connections
   */
  private handleConnection(socket: WebSocket, request: IncomingMessage) {
    // Parse the URL to get userId from query parameters
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const userId = Number(url.searchParams.get('userId'));
    
    if (!userId || isNaN(userId)) {
      log('Rejected WebSocket connection: Invalid userId', 'websocket');
      socket.close(1008, 'Invalid userId');
      return;
    }
    
    log(`WebSocket connection established for user ${userId}`, 'websocket');
    
    // Store the connection with user ID
    this.activeConnections.set(socket, { userId, socket, lastPing: Date.now() });
    
    // Handle incoming messages
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'pong') {
          const connection = this.activeConnections.get(socket);
          if (connection) {
            connection.lastPing = Date.now();
          }
        }
      } catch (error) {
        log(`Error parsing WebSocket message: ${error}`, 'websocket');
      }
    });
    
    // Handle connection close
    socket.on('close', () => {
      log(`WebSocket connection closed for user ${userId}`, 'websocket');
      this.activeConnections.delete(socket);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      log(`WebSocket error for user ${userId}: ${error}`, 'websocket');
      this.activeConnections.delete(socket);
    });
    
    // Send a welcome message
    this.sendToUser(userId, {
      type: 'system',
      message: 'Connected to VaultBox notification service'
    });
  }
  
  /**
   * Ping all connections to keep them alive and detect stale connections
   */
  private pingConnections() {
    const now = Date.now();
    this.activeConnections.forEach((connection, socket) => {
      // Check if connection is still alive (last ping within 2 minutes)
      if (connection.lastPing && now - connection.lastPing > 120000) {
        log(`Closing stale WebSocket connection for user ${connection.userId}`, 'websocket');
        socket.close(1001, 'Connection timeout');
        this.activeConnections.delete(socket);
        return;
      }
      
      // Send ping if socket is open
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', timestamp: now }));
      }
    });
  }
  
  /**
   * Send a notification to a specific user
   */
  sendToUser(userId: number, data: any) {
    let sent = false;
    this.activeConnections.forEach((connection) => {
      if (connection.userId === userId && connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify(data));
        sent = true;
      }
    });
    return sent;
  }
  
  /**
   * Send a notification to multiple users
   */
  sendToUsers(userIds: number[], data: any) {
    const sentTo: number[] = [];
    
    userIds.forEach(userId => {
      if (this.sendToUser(userId, data)) {
        sentTo.push(userId);
      }
    });
    
    return sentTo;
  }
  
  /**
   * Send a notification to all connected users
   */
  broadcast(data: any, excludeUserId?: number) {
    let count = 0;
    this.activeConnections.forEach((connection) => {
      if ((excludeUserId === undefined || connection.userId !== excludeUserId) && 
          connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify(data));
        count++;
      }
    });
    return count;
  }
  
  /**
   * Push a notification to a user
   */
  pushNotification(userId: number, notification: Notification) {
    return this.sendToUser(userId, {
      type: 'notification',
      data: notification
    });
  }
  
  /**
   * Get count of active connections
   */
  getActiveConnectionsCount() {
    return this.activeConnections.size;
  }
  
  /**
   * Get count of active connections by user ID
   */
  getActiveConnectionsCountByUser(userId: number) {
    let count = 0;
    this.activeConnections.forEach(connection => {
      if (connection.userId === userId) {
        count++;
      }
    });
    return count;
  }
}

// Export a singleton instance
export const webSocketService = new WebSocketService();