import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, userStatusEnum } from "@shared/schema";
import * as speakeasy from "speakeasy";
import * as QRCode from "qrcode";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Max failed login attempts before locking account
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

// Password hashing with strong security
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Secure password comparison with timing-safe equality check
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Generates a random recovery key
function generateRecoveryKeys(count: number = 10): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const key = randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g)?.join('-') || '';
    keys.push(key);
  }
  return keys;
}

// Helper function to verify 2FA code
function verify2FA(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1 // Allow 30 seconds before/after for clock drift
  });
}

// Middleware to check if user account is locked
async function checkAccountStatus(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    const user = req.user as SelectUser;
    
    // Check if account is locked or suspended
    if (user.status === 'locked' || user.status === 'suspended') {
      req.logout((err) => {
        if (err) return next(err);
        return res.status(403).json({ 
          error: 'Account locked', 
          message: user.status === 'locked' 
            ? 'Your account has been locked due to too many failed login attempts. Please reset your password.' 
            : 'Your account has been suspended. Please contact support.'
        });
      });
      return;
    }
  }
  next();
}

export function setupAuth(app: Express) {
  // Enhanced session security
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "vaultbox-secure-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(checkAccountStatus);

  // Enhanced local strategy with account locking
  passport.use(
    new LocalStrategy({
      passReqToCallback: true // Pass request to callback
    }, async (req: Request, username: string, password: string, done: any) => {
      try {
        // Find user by username or email
        let user = await storage.getUserByUsername(username);
        if (!user) {
          user = await storage.getUserByEmail(username);
        }
        
        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }
        
        // Check if account is locked
        if (user.status === 'locked' || user.status === 'suspended') {
          return done(null, false, { 
            message: user.status === 'locked' 
              ? 'Your account has been locked due to too many failed login attempts.' 
              : 'Your account has been suspended. Please contact support.'
          });
        }
        
        // Verify password
        const isValid = await comparePasswords(password, user.password);
        
        if (!isValid) {
          // Increment failed login attempts
          const attempts = (user.failedLoginAttempts ?? 0) + 1;
          await storage.updateUserFailedLoginAttempts(user.id, attempts);
          
          // Lock account if max attempts reached
          if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
            await storage.updateUser(user.id, { status: 'locked' as any });
            
            // Log security event
            await storage.createActivityLog({
              userId: user.id,
              action: "security_alert",
              details: "Account locked due to too many failed login attempts",
              metadata: { ipAddress: req.ip },
              deviceInfo: req.headers['user-agent']
            });
            
            // Create notification
            await storage.createNotification({
              userId: user.id,
              title: "Account Security Alert",
              message: "Your account has been locked due to too many failed login attempts. Please reset your password to regain access.",
              type: "security_alert",
              priority: "high"
            });
            
            return done(null, false, { message: "Account locked due to too many failed login attempts" });
          }
          
          return done(null, false, { message: "Invalid credentials" });
        }
        
        // Reset failed login attempts on successful login
        if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
          await storage.updateUserFailedLoginAttempts(user.id, 0);
        }
        
        // If 2FA is enabled, additional verification will happen in a separate step
        await storage.updateUserLastLogin(user.id);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Enhanced registration with email support and security features
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, email, password, fullName, twoFactorEnabled } = req.body;

      if (!username || !password || !fullName || !email) {
        return res.status(400).send("Missing required fields");
      }

      // Check for duplicate username or email
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).send("Username already exists");
      }
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).send("Email already in use");
      }
      
      // Create user with enhanced security
      const user = await storage.createUser({
        username,
        email,
        password: await hashPassword(password),
        fullName,
        twoFactorEnabled: !!twoFactorEnabled
      });
      
      // Generate recovery keys if 2FA is enabled
      if (twoFactorEnabled) {
        const recoveryKeys = generateRecoveryKeys();
        await storage.updateUser(user.id, { 
          recoveryKeys: recoveryKeys 
        });
      }

      // Create activity log and initial security score
      await storage.createActivityLog({
        userId: user.id,
        action: "account_created",
        details: "Account created successfully",
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      // Calculate initial security score
      let securityScore = 50; // Base score
      if (password.length >= 12) securityScore += 10; // Strong password
      if (twoFactorEnabled) securityScore += 20; // 2FA enabled
      
      await storage.updateUserSecurityScore(user.id, securityScore);

      // Create welcome notification
      await storage.createNotification({
        userId: user.id,
        title: "Welcome to VaultBox",
        message: "Thank you for joining VaultBox. Your secure digital vault is ready to use.",
        type: "welcome",
        priority: "medium"
      });
      
      // Register device information
      const deviceId = randomBytes(16).toString('hex');
      await storage.createUserDevice({
        userId: user.id,
        deviceName: req.headers['user-agent']?.split(' ')[0] || 'Unknown device',
        deviceId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        isApproved: true
      });

      // Auto login after registration
      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (err) {
      next(err);
    }
  });

  // Enhanced login with 2FA support
  app.post("/api/login", (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      
      if (!user) {
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }
      
      // If 2FA is enabled, check if token is provided
      if (user.twoFactorEnabled) {
        const { twoFactorToken } = req.body;
        
        // If no token provided, return need for 2FA
        if (!twoFactorToken) {
          return res.status(200).json({ 
            requiresTwoFactor: true,
            userId: user.id,
            message: "Two-factor authentication required" 
          });
        }
        
        // Verify 2FA token
        if (!user.twoFactorSecret || !verify2FA(user.twoFactorSecret, twoFactorToken)) {
          // Log failed 2FA attempt
          storage.createActivityLog({
            userId: user.id,
            action: "security_alert",
            details: "Failed two-factor authentication attempt",
            ipAddress: req.ip,
            deviceInfo: req.headers['user-agent']
          });
          
          return res.status(401).json({ error: "Invalid two-factor authentication code" });
        }
      }
      
      // Complete login
      req.login(user, async (err) => {
        if (err) return next(err);
        
        // Create activity log
        await storage.createActivityLog({
          userId: user.id,
          action: "login",
          details: "User logged in",
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent']
        });
        
        // Update last login time and reset inactivity timer
        await storage.updateUserLastLogin(user.id);
        
        // Reset inactivity timer for trusted contacts
        const trustedContact = await storage.getTrustedContactByUserId(user.id);
        if (trustedContact) {
          await storage.updateTrustedContactInactivityReset(trustedContact.id);
          
          // Log the inactivity reset
          await storage.createActivityLog({
            userId: user.id,
            action: "inactivity_threshold_reset",
            details: `Inactivity timer reset for trusted contact ${trustedContact.name}`,
            ipAddress: req.ip,
            deviceInfo: req.headers['user-agent']
          });
        }
        
        // Check if this is a new device and register it
        const existingDevice = await storage.getUserDeviceByDeviceId(
          user.id, 
          req.headers['user-agent'] || 'unknown'
        );
        
        if (!existingDevice) {
          const deviceId = randomBytes(16).toString('hex');
          await storage.createUserDevice({
            userId: user.id,
            deviceName: req.headers['user-agent']?.split(' ')[0] || 'New device',
            deviceId,
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip,
            isApproved: true
          });
          
          // Notify user of new device login
          await storage.createNotification({
            userId: user.id,
            title: "New Device Login",
            message: `A new device was used to access your account. If this wasn't you, please change your password immediately.`,
            type: "security_alert",
            priority: "medium"
          });
        } else {
          // Update existing device last used time
          await storage.updateUserDevice(existingDevice.id, {
            lastUsed: new Date(),
            ipAddress: req.ip
          });
        }
        
        const { password, twoFactorSecret, recoveryKeys, ...safeUser } = user;
        res.status(200).json(safeUser);
      });
    })(req, res, next);
  });

  // Verify 2FA token for second step authentication
  app.post("/api/verify-2fa", async (req, res, next) => {
    try {
      const { userId, twoFactorToken } = req.body;
      
      if (!userId || !twoFactorToken) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const user = await storage.getUser(parseInt(userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: "Two-factor authentication not set up" });
      }
      
      // Verify 2FA token
      if (!verify2FA(user.twoFactorSecret, twoFactorToken)) {
        // Log failed 2FA attempt
        await storage.createActivityLog({
          userId: user.id,
          action: "security_alert",
          details: "Failed two-factor authentication attempt",
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent']
        });
        
        return res.status(401).json({ error: "Invalid two-factor authentication code" });
      }
      
      // Complete login
      req.login(user, async (err) => {
        if (err) return next(err);
        
        // Create activity log
        await storage.createActivityLog({
          userId: user.id,
          action: "login",
          details: "User completed two-factor authentication",
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent']
        });
        
        // Update last login time
        await storage.updateUserLastLogin(user.id);
        
        const { password, twoFactorSecret, recoveryKeys, ...safeUser } = user;
        res.status(200).json(safeUser);
      });
    } catch (err) {
      next(err);
    }
  });

  // Setup 2FA for a user
  app.post("/api/setup-2fa", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = req.user as SelectUser;
      
      // Generate new secret
      const secret = speakeasy.generateSecret({
        name: `VaultBox:${user.username}`
      });
      
      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');
      
      // Generate recovery keys
      const recoveryKeys = generateRecoveryKeys();
      
      // Just return the setup data, don't save yet until user confirms with a valid token
      // We'll save this in the verify-2fa-setup endpoint
      
      // Log activity of 2FA setup initiation
      await storage.createActivityLog({
        userId: user.id,
        action: "security_settings_changed",
        details: "Two-factor authentication setup initiated",
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      res.status(200).json({
        secret: secret.base32,
        qrCode: qrCodeUrl,
        recoveryKeys,
        message: "Two-factor authentication setup initiated"
      });
    } catch (err) {
      next(err);
    }
  });
  
  // Verify and complete 2FA setup
  app.post("/api/verify-2fa-setup", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = req.user as SelectUser;
      const { secret, token, recoveryKeys } = req.body;
      
      if (!secret || !token || !recoveryKeys) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Verify token against the provided secret
      if (!verify2FA(secret, token)) {
        return res.status(401).json({ error: "Invalid verification code" });
      }
      
      // Save 2FA configuration
      await storage.updateUser(user.id, {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        recoveryKeys,
        securityScore: Math.min(100, (user.securityScore || 50) + 20) // Increase security score
      });
      
      // Log successful 2FA setup
      await storage.createActivityLog({
        userId: user.id,
        action: "security_settings_changed",
        details: "Two-factor authentication enabled",
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      // Create notification
      await storage.createNotification({
        userId: user.id,
        title: "Two-Factor Authentication Enabled",
        message: "Your account is now protected with two-factor authentication, providing an extra layer of security.",
        type: "security_alert",
        priority: "medium"
      });
      
      // Return updated user
      const updatedUser = await storage.getUser(user.id);
      const { password, twoFactorSecret, ...safeUser } = updatedUser!;
      
      res.status(200).json({
        ...safeUser,
        message: "Two-factor authentication enabled successfully"
      });
    } catch (err) {
      next(err);
    }
  });

  // Disable 2FA for a user
  app.post("/api/disable-2fa", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = req.user as SelectUser;
      const { password, twoFactorToken } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: "Password is required to disable 2FA" });
      }
      
      // Verify password
      if (!(await comparePasswords(password, user.password))) {
        return res.status(401).json({ error: "Invalid password" });
      }
      
      // If 2FA is already enabled, also check 2FA code
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        if (!twoFactorToken) {
          return res.status(400).json({ error: "Two-factor authentication code required" });
        }
        
        if (!verify2FA(user.twoFactorSecret, twoFactorToken)) {
          return res.status(401).json({ error: "Invalid two-factor authentication code" });
        }
      }
      
      // Disable 2FA
      await storage.updateUser(user.id, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        recoveryKeys: null,
        securityScore: Math.max(1, (user.securityScore || 50) - 20) // Decrease security score
      });
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: "security_settings_changed",
        details: "Two-factor authentication disabled",
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      // Create security notification
      await storage.createNotification({
        userId: user.id,
        title: "Security Alert",
        message: "Two-factor authentication has been disabled for your account. If you did not make this change, please secure your account immediately.",
        type: "security_alert",
        priority: "high"
      });
      
      res.status(200).json({ message: "Two-factor authentication disabled" });
    } catch (err) {
      next(err);
    }
  });

  // Use recovery key to bypass 2FA (in case of lost device)
  app.post("/api/use-recovery-key", async (req, res, next) => {
    try {
      const { username, password, recoveryKey } = req.body;
      
      if (!username || !password || !recoveryKey) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Verify password
      if (!(await comparePasswords(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check if recovery key is valid
      const recoveryKeys = user.recoveryKeys as string[] || [];
      if (!recoveryKeys.includes(recoveryKey)) {
        // Log failed recovery attempt
        await storage.createActivityLog({
          userId: user.id,
          action: "security_alert",
          details: "Failed recovery key attempt",
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent']
        });
        
        return res.status(401).json({ error: "Invalid recovery key" });
      }
      
      // Remove used recovery key
      const updatedKeys = recoveryKeys.filter(key => key !== recoveryKey);
      await storage.updateUser(user.id, { recoveryKeys: updatedKeys });
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: "security_alert",
        details: "Recovery key used for authentication",
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      // Create notification about recovery key usage
      await storage.createNotification({
        userId: user.id,
        title: "Recovery Key Used",
        message: "A recovery key was used to access your account. If this wasn't you, please secure your account immediately.",
        type: "security_alert",
        priority: "high"
      });
      
      // Complete login
      req.login(user, async (err) => {
        if (err) return next(err);
        
        await storage.updateUserLastLogin(user.id);
        
        const { password, twoFactorSecret, recoveryKeys, ...safeUser } = user;
        res.status(200).json({ ...safeUser, recoveryKeysRemaining: updatedKeys.length });
      });
    } catch (err) {
      next(err);
    }
  });

  // Password change/reset with security logging
  app.post("/api/change-password", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = req.user as SelectUser;
      const { currentPassword, newPassword, twoFactorToken } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Verify current password
      if (!(await comparePasswords(currentPassword, user.password))) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      
      // If 2FA is enabled, verify token
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        if (!twoFactorToken) {
          return res.status(400).json({ error: "Two-factor authentication code required" });
        }
        
        if (!verify2FA(user.twoFactorSecret, twoFactorToken)) {
          return res.status(401).json({ error: "Invalid two-factor authentication code" });
        }
      }
      
      // Update password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, {
        password: hashedPassword,
        passwordUpdatedAt: new Date(),
        status: 'active' as any // Unlock account if it was locked
      });
      
      // Recalculate security score
      let securityScore = user.securityScore || 50;
      if (newPassword.length >= 12) {
        securityScore = Math.min(100, securityScore + 10);
      }
      await storage.updateUserSecurityScore(user.id, securityScore);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: "security_settings_changed",
        details: "Password changed",
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      // Create notification
      await storage.createNotification({
        userId: user.id,
        title: "Password Changed",
        message: "Your password has been successfully changed.",
        type: "security_alert",
        priority: "medium"
      });
      
      res.status(200).json({ message: "Password changed successfully" });
    } catch (err) {
      next(err);
    }
  });

  // Account unlocking mechanism
  app.post("/api/unlock-account", async (req, res, next) => {
    try {
      const { username, email } = req.body;
      
      if (!username && !email) {
        return res.status(400).json({ error: "Username or email is required" });
      }
      
      // Find user
      let user;
      if (username) {
        user = await storage.getUserByUsername(username);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.status !== 'locked') {
        return res.status(400).json({ error: "Account is not locked" });
      }
      
      // Generate unlock token (in a real app, send this via email)
      const unlockToken = randomBytes(32).toString('hex');
      
      // Store token in user's metadata for verification
      await storage.updateUser(user.id, {
        preferences: {
          ...user.preferences,
          unlockToken,
          unlockTokenExpiry: new Date(Date.now() + 3600000) // 1 hour
        }
      });
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: "security_alert",
        details: "Account unlock requested",
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      // In a real app, we would send an email with the unlock link
      // For demo purposes, return the token directly
      res.status(200).json({
        message: "Account unlock instructions sent",
        unlockToken // In production, remove this and send via email
      });
    } catch (err) {
      next(err);
    }
  });

  // Verify the unlock token and unlock account
  app.post("/api/verify-unlock", async (req, res, next) => {
    try {
      const { username, unlockToken } = req.body;
      
      if (!username || !unlockToken) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if account is locked
      if (user.status !== 'locked') {
        return res.status(400).json({ error: "Account is not locked" });
      }
      
      // Verify unlock token
      const preferences = user.preferences as any || {};
      const storedToken = preferences.unlockToken;
      const tokenExpiry = preferences.unlockTokenExpiry;
      
      if (!storedToken || storedToken !== unlockToken) {
        return res.status(401).json({ error: "Invalid unlock token" });
      }
      
      if (tokenExpiry && new Date(tokenExpiry) < new Date()) {
        return res.status(400).json({ error: "Unlock token expired" });
      }
      
      // Unlock account
      await storage.updateUser(user.id, {
        status: 'active' as any,
        failedLoginAttempts: 0,
        preferences: {
          ...preferences,
          unlockToken: null,
          unlockTokenExpiry: null
        }
      });
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: "security_settings_changed",
        details: "Account unlocked",
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      // Create notification
      await storage.createNotification({
        userId: user.id,
        title: "Account Unlocked",
        message: "Your account has been unlocked. If you didn't request this, please secure your account immediately.",
        type: "security_alert",
        priority: "high"
      });
      
      res.status(200).json({ message: "Account unlocked successfully" });
    } catch (err) {
      next(err);
    }
  });

  // Enhanced logout with security logging
  app.post("/api/logout", (req, res, next) => {
    if (req.isAuthenticated()) {
      const userId = (req.user as SelectUser).id;
      
      // Create activity log before logout
      storage.createActivityLog({
        userId,
        action: "logout",
        details: "User logged out",
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      }).then(() => {
        req.logout((err) => {
          if (err) return next(err);
          res.sendStatus(200);
        });
      }).catch(next);
    } else {
      res.sendStatus(200);
    }
  });

  // Enhanced user info endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as SelectUser;
    
    // Remove sensitive information
    const { 
      password, 
      twoFactorSecret, 
      recoveryKeys,
      ...safeUser 
    } = user;
    
    res.json({
      ...safeUser,
      has2FA: !!user.twoFactorEnabled,
      recoveryKeysAvailable: Array.isArray(recoveryKeys) ? recoveryKeys.length : 0
    });
  });
}
