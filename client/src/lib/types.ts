// Type definitions matching our database schema
export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt?: string;
  failedLoginAttempts: number;
  isLockedOut: boolean;
  isTwoFactorEnabled: boolean;
  twoFactorSecret?: string;
  status: 'active' | 'locked' | 'suspended' | 'unverified';
  securityScore: number;
}

export interface VaultEntry {
  id: number;
  userId: number;
  title: string;
  description?: string;
  category: string;
  encryptedData: string;
  iv: string;
  favorite: boolean;
  status: 'active' | 'locked' | 'shared' | 'expiring';
  createdAt: string;
  updatedAt: string;
  notes?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface TrustedContact {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone?: string;
  relationshipType: 'family' | 'friend' | 'legal' | 'medical' | 'other';
  status: 'pending' | 'active' | 'declined' | 'revoked';
  accessLevel: 'emergency_only' | 'full_access' | 'limited_access' | 'temporary_access';
  inactivityPeriod: number;
  lastInactivityResetDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequest {
  id: number;
  contactId: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  reason: string;
  requestedAt: string;
  autoApproveAt: string;
  responseNote?: string;
  accessToken?: string;
  accessExpiresAt?: string;
}

export interface SharedEntry {
  id: number;
  entryId: number;
  contactId: number;
  isEmergencyAccessible: boolean;
  shareExpirationDate?: string;
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

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;
}