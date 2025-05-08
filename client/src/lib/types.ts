export interface TrustedContact {
  id: number;
  userId: number;
  name: string;
  email: string;
  relationship: 'family' | 'friend' | 'legal' | 'medical' | 'other';
  inactivityPeriod: number;
  waitingPeriod: string;
  status: 'pending' | 'active' | 'declined' | 'revoked';
  personalMessage?: string;
  lastInactivityResetDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultEntry {
  id: number;
  userId: number;
  title: string;
  content: string;
  category: string;
  status: 'active' | 'locked' | 'shared' | 'expiring';
  metadata?: Record<string, any>;
  isFavorite: boolean;
  expireAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequest {
  id: number;
  contactId: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  reason: string;
  requestedAt: string;
  respondedAt?: string;
  autoApproveAt: string;
  expiresAt: string;
  ipAddress?: string;
  deviceInfo?: string;
  urgencyLevel?: string;
}

export interface SharedEntry {
  id: number;
  entryId: number;
  contactId: number;
  accessLevel: 'emergency_only' | 'full_access' | 'limited_access' | 'temporary_access';
  sharedAt: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  actionUrl?: string;
  metadata?: Record<string, any>;
  expiresAt?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: number;
  userId: number;
  action: string;
  details: string;
  ipAddress?: string;
  deviceInfo?: string;
  timestamp: string;
}