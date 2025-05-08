import { Notification, NotificationPreference, User } from '@shared/schema';
import { storage } from '../storage';
import { webSocketService } from './websocket';
import { 
  sendNotificationEmail, 
  sendSecurityAlertEmail, 
  sendDigestEmail 
} from './email';
import { log } from '../vite';

interface CreateNotificationParams {
  userId: number;
  title: string;
  message: string;
  type: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
  actionUrl?: string;
  expiresAt?: Date;
}

// Pending digest notifications for batched emails
interface DigestItem {
  userId: number;
  notifications: Array<{
    title: string;
    message: string;
    timestamp: string;
    actionUrl?: string;
  }>;
}

class NotificationService {
  private dailyDigests: Map<number, DigestItem> = new Map();
  private weeklyDigests: Map<number, DigestItem> = new Map();
  
  constructor() {
    // Set up digest email schedules
    if (process.env.NODE_ENV === 'production') {
      // Schedule daily digest emails to be sent at 9 AM
      this.scheduleDigestEmails('daily');
      
      // Schedule weekly digest emails to be sent on Monday at 9 AM
      this.scheduleDigestEmails('weekly');
    }
  }
  
  /**
   * Create and send a notification to a user
   */
  async createNotification(params: CreateNotificationParams): Promise<Notification> {
    try {
      // Create notification record in database
      const notification = await storage.createNotification({
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
        priority: params.priority || 'medium',
        metadata: params.metadata || {},
        actionUrl: params.actionUrl,
        expiresAt: params.expiresAt
      });
      
      // Get user and preferences
      const user = await storage.getUser(params.userId);
      
      if (!user) {
        log(`User not found for notification: ${params.userId}`, 'notification');
        return notification;
      }
      
      // Try to get notification preferences, fall back to defaults if not found
      let preferences: NotificationPreference | undefined;
      try {
        preferences = await this.getUserNotificationPreferences(params.userId);
      } catch (error) {
        log(`Error getting notification preferences: ${error}`, 'notification');
      }
      
      // Send real-time notification via WebSocket if in-app notifications are enabled
      if (!preferences || preferences.inAppEnabled) {
        const sent = webSocketService.pushNotification(params.userId, notification);
        if (sent) {
          log(`Real-time notification sent to user ${params.userId}`, 'notification');
        }
      }
      
      // Send email notification if enabled
      if (preferences?.emailEnabled && user.email) {
        await this.handleEmailNotification(user, notification, preferences);
      }
      
      return notification;
    } catch (error) {
      log(`Error creating notification: ${error}`, 'notification');
      throw error;
    }
  }
  
  /**
   * Handle sending email notifications based on user preferences
   */
  private async handleEmailNotification(
    user: User, 
    notification: Notification, 
    preferences: NotificationPreference
  ) {
    // For critical security notifications, always send immediately
    if (notification.priority === 'critical' && 
        (notification.type.startsWith('security_') || preferences.securityAlertsEnabled)) {
      await sendSecurityAlertEmail(
        user.email,
        notification.title,
        notification.message,
        notification.metadata as Record<string, string>
      );
      return;
    }
    
    // For other notifications, respect frequency preferences
    switch (preferences.emailFrequency) {
      case 'immediate':
        await sendNotificationEmail(
          user.email,
          notification.title,
          notification.message,
          notification.actionUrl || undefined
        );
        break;
        
      case 'daily':
        this.addToDigest(notification, user.id, 'daily');
        break;
        
      case 'weekly':
        this.addToDigest(notification, user.id, 'weekly');
        break;
    }
  }
  
  /**
   * Add notification to a digest queue
   */
  private addToDigest(notification: Notification, userId: number, frequency: 'daily' | 'weekly') {
    const digestMap = frequency === 'daily' ? this.dailyDigests : this.weeklyDigests;
    
    if (!digestMap.has(userId)) {
      digestMap.set(userId, { 
        userId, 
        notifications: [] 
      });
    }
    
    const digest = digestMap.get(userId)!;
    
    digest.notifications.push({
      title: notification.title,
      message: notification.message,
      timestamp: new Date(notification.createdAt).toLocaleString(),
      actionUrl: notification.actionUrl || undefined
    });
  }
  
  /**
   * Get notification preferences for a user, creating if not exists
   */
  async getUserNotificationPreferences(userId: number): Promise<NotificationPreference> {
    try {
      // Try to get existing preferences
      const preferences = await storage.getNotificationPreferences(userId);
      
      // If preferences exist, return them
      if (preferences) {
        return preferences;
      }
      
      // Otherwise create default preferences
      return await storage.createNotificationPreferences({
        userId,
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        emailFrequency: 'immediate',
        securityAlertsEnabled: true,
        activityAlertsEnabled: true,
        updatesEnabled: true,
        emailVerified: false
      });
    } catch (error) {
      log(`Error getting notification preferences: ${error}`, 'notification');
      throw error;
    }
  }
  
  /**
   * Schedule digest emails to be sent
   */
  private scheduleDigestEmails(frequency: 'daily' | 'weekly') {
    const sendDigests = async () => {
      const digestMap = frequency === 'daily' ? this.dailyDigests : this.weeklyDigests;
      
      // Process each digest
      for (const [userId, digest] of digestMap.entries()) {
        try {
          // Only send if there are notifications
          if (digest.notifications.length > 0) {
            // Get user email
            const user = await storage.getUser(userId);
            if (user && user.email) {
              await sendDigestEmail(user.email, digest.notifications);
              log(`Sent ${frequency} digest to user ${userId} with ${digest.notifications.length} notifications`, 'notification');
            }
          }
          
          // Clear the digest
          digestMap.delete(userId);
        } catch (error) {
          log(`Error sending ${frequency} digest to user ${userId}: ${error}`, 'notification');
        }
      }
    };
    
    // Calculate time until 9 AM
    const now = new Date();
    let targetTime = new Date(now);
    targetTime.setHours(9, 0, 0, 0);
    
    // If it's already past 9 AM, schedule for tomorrow
    if (now > targetTime) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    // For weekly, ensure it's Monday (1)
    if (frequency === 'weekly') {
      while (targetTime.getDay() !== 1) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
    }
    
    // Calculate ms until target time
    const msUntilTarget = targetTime.getTime() - now.getTime();
    
    // Schedule initial run
    setTimeout(() => {
      sendDigests();
      
      // Then schedule recurring runs
      setInterval(sendDigests, frequency === 'daily' ? 86400000 : 604800000);
    }, msUntilTarget);
    
    log(`Scheduled ${frequency} digest emails to run at ${targetTime.toLocaleString()}`, 'notification');
  }
  
  /**
   * Delete expired notifications
   */
  async deleteExpiredNotifications(): Promise<number> {
    try {
      const count = await storage.deleteExpiredNotifications();
      if (count > 0) {
        log(`Deleted ${count} expired notifications`, 'notification');
      }
      return count;
    } catch (error) {
      log(`Error deleting expired notifications: ${error}`, 'notification');
      return 0;
    }
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();