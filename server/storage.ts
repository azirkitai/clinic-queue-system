import { type User, type InsertUser, type Patient, type InsertPatient, type Setting, type InsertSetting, type Media, type InsertMedia, type TextGroup, type InsertTextGroup, type Theme, type InsertTheme, type QrSession, type InsertQrSession, users, settings, themes, textGroups, qrSessions } from "@shared/schema";
import * as schema from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

interface Window {
  id: string;
  name: string;
  isActive: boolean;
  currentPatientId?: string;
  currentPatientName?: string;
  currentPatientNumber?: number;
  userId: string;
}

interface InsertWindow {
  name: string;
  userId: string;
}

// TV Token utility - generates deterministic token from userId
function generateTvToken(userId: string): string {
  const hash = createHash('sha256')
    .update(`tv-token-${userId}-clinic-display`)
    .digest('hex');
  return hash.substring(0, 32); // First 32 chars for security
}

// Token resolution - extract userId from token
function resolveUserIdFromToken(token: string, allUsers: User[]): string | undefined {
  for (const user of allUsers) {
    if (generateTvToken(user.id) === token) {
      return user.id;
    }
  }
  return undefined;
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUser(userId: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(userId: string): Promise<boolean>;
  toggleUserStatus(userId: string): Promise<User | undefined>;
  // Authentication methods
  authenticateUser(username: string, password: string): Promise<User | null>;
  // TV Token methods
  getUserByTvToken(token: string): Promise<User | undefined>;
  generateTvToken(userId: string): string;
  
  // Patient methods
  createPatient(patient: InsertPatient): Promise<Patient>;
  getPatients(userId: string): Promise<Patient[]>;
  getPatientsByDate(date: string, userId: string): Promise<Patient[]>;
  getNextPatientNumber(userId: string): Promise<number>;
  updatePatientStatus(patientId: string, status: string, userId: string, windowId?: string | null, requeueReason?: string): Promise<Patient | undefined>;
  togglePatientPriority(patientId: string, userId: string): Promise<Patient | undefined>;
  deletePatient(patientId: string, userId: string): Promise<boolean>;
  archiveCompletedPatients(userId: string): Promise<number>; // Soft delete completed patients for queue reset
  deleteAllTodayPatients(userId: string): Promise<number>; // Delete ALL today's patients for complete queue reset
  
  // Window methods
  getWindows(userId: string): Promise<Window[]>;
  createWindow(insertWindow: InsertWindow): Promise<Window>;
  updateWindow(windowId: string, name: string, userId: string): Promise<Window | undefined>;
  deleteWindow(windowId: string, userId: string): Promise<boolean>;
  toggleWindowStatus(windowId: string, userId: string): Promise<Window | undefined>;
  updateWindowPatient(windowId: string, userId: string, patientId?: string): Promise<Window | undefined>;
  
  // Dashboard methods
  getDashboardStats(userId: string): Promise<{
    totalWaiting: number;
    totalCalled: number;
    totalCompleted: number;
    activeWindows: number;
    totalWindows: number;
  }>;
  getCurrentCall(userId: string): Promise<Patient | undefined>;
  getRecentHistory(userId: string, limit?: number): Promise<Patient[]>;
  
  // Settings methods
  getSettings(userId: string): Promise<Setting[]>;
  getSetting(key: string, userId: string): Promise<Setting | undefined>;
  getSettingsByCategory(category: string, userId: string): Promise<Setting[]>;
  setSetting(key: string, value: string, category: string, userId: string): Promise<Setting>;
  updateSetting(key: string, value: string, userId: string): Promise<Setting | undefined>;
  deleteSetting(key: string, userId: string): Promise<boolean>;
  
  // Media methods
  getMedia(userId: string): Promise<Media[]>;
  getMediaById(id: string, userId: string): Promise<Media | undefined>;
  createMedia(media: InsertMedia): Promise<Media>;
  updateMedia(id: string, updates: Partial<Media>, userId: string): Promise<Media | undefined>;
  deleteMedia(id: string, userId: string): Promise<boolean>;
  getActiveMedia(userId: string): Promise<Media[]>;
  
  // Theme methods
  getThemes(userId: string): Promise<Theme[]>;
  getActiveTheme(userId: string): Promise<Theme | undefined>;
  getThemeById(id: string, userId: string): Promise<Theme | undefined>;
  createTheme(theme: InsertTheme): Promise<Theme>;
  updateTheme(id: string, updates: Partial<Theme>, userId: string): Promise<Theme | undefined>;
  deleteTheme(id: string, userId: string): Promise<boolean>;
  setActiveTheme(id: string, userId: string): Promise<Theme | undefined>;
  
  // Text Group methods
  getTextGroups(userId: string): Promise<TextGroup[]>;
  getActiveTextGroups(userId: string): Promise<TextGroup[]>;
  getTextGroupByName(groupName: string, userId: string): Promise<TextGroup | undefined>;
  getTextGroupById(id: string, userId: string): Promise<TextGroup | undefined>;
  createTextGroup(textGroup: InsertTextGroup): Promise<TextGroup>;
  updateTextGroup(id: string, updates: Partial<TextGroup>, userId: string): Promise<TextGroup | undefined>;
  deleteTextGroup(id: string, userId: string): Promise<boolean>;
  toggleTextGroupStatus(id: string, userId: string): Promise<TextGroup | undefined>;
  
  // QR Session methods
  createQrSession(qrSession: InsertQrSession): Promise<QrSession>;
  getQrSession(id: string): Promise<QrSession | undefined>;
  authorizeQrSession(id: string, userId: string, tvVerifierHash?: string): Promise<QrSession | undefined>;
  finalizeQrSession(id: string, tvVerifier: string): Promise<{ success: boolean; userId?: string }>;
  expireOldQrSessions(): Promise<void>;
  
}

export class MemStorage implements IStorage {
  private patients: Map<string, Patient>;
  private windows: Map<string, Window>;
  private settings: Map<string, Setting>; // Will be keyed by ${userId}:${key}
  private media: Map<string, Media>;
  private themes: Map<string, Theme>;
  private textGroups: Map<string, TextGroup>;
  private qrSessions: Map<string, QrSession>;
  private systemUserId: string;

  constructor() {
    this.patients = new Map();
    this.windows = new Map();
    this.settings = new Map();
    this.media = new Map();
    this.themes = new Map();
    this.textGroups = new Map();
    this.qrSessions = new Map();
    
    // Use a default system user ID for settings that need user association
    this.systemUserId = "system";
    
    // Initialize default settings, theme, and text groups
    this.initializeDefaultSettings();
    this.initializeDefaultTheme();
    this.initializeDefaultTextGroups();
  }
  
  private async initializeDefaultSettings() {
    // Only create default settings if they don't already exist
    const defaultSettings = [
      { key: "mediaType", value: "image", category: "display" },
      { key: "theme", value: "blue", category: "display" },
      { key: "showPrayerTimes", value: "true", category: "display" },
      { key: "showWeather", value: "false", category: "display" },
      { key: "marqueeText", value: "Selamat datang ke Klinik Kesihatan", category: "display" },
      { key: "marqueeColor", value: "#ffffff", category: "display" },
      { key: "marqueeBackgroundColor", value: "#1e40af", category: "display" },
      { key: "enableSound", value: "true", category: "sound" },
      { key: "volume", value: "70", category: "sound" },
      { key: "soundMode", value: "preset", category: "sound" },
      { key: "presetKey", value: "airport_call", category: "sound" }
    ];

    for (const setting of defaultSettings) {
      // Only set if the setting doesn't already exist for system
      const systemKey = `${this.systemUserId}:${setting.key}`;
      if (!this.settings.has(systemKey)) {
        await this.setSetting(setting.key, setting.value, setting.category, this.systemUserId);
      }
    }
  }
  
  private async initializeDefaultTheme() {
    const defaultTheme: Theme = {
      id: randomUUID(),
      name: "Default Theme",
      isActive: true,
      primaryColor: "#3b82f6",
      secondaryColor: "#6b7280",
      callingColor: "#3b82f6",
      highlightBoxColor: "#ef4444",
      historyNameColor: "#6b7280",
      clinicNameColor: "#1f2937",
      modalBackgroundColor: "#1e293b",
      modalBorderColor: "#fbbf24",
      modalTextColor: "#ffffff",
      callingGradient: null,
      highlightBoxGradient: null,
      historyNameGradient: null,
      clinicNameGradient: null,
      backgroundColor: "#ffffff",
      backgroundGradient: null,
      accentColor: "#f3f4f6",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: this.systemUserId,
    };
    this.themes.set(defaultTheme.id, defaultTheme);
  }
  
  private async initializeDefaultTextGroups() {
    const defaultTextGroups: TextGroup[] = [
      {
        id: randomUUID(),
        groupName: "clinic_name",
        displayName: "Clinic Name",
        description: "Main clinic name display text",
        color: "#1f2937",
        backgroundColor: null,
        fontSize: "clamp(2rem, 3.5vw, 3.5rem)",
        fontWeight: "bold",
        textAlign: "center",
        gradient: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: this.systemUserId,
      }
    ];
    
    for (const textGroup of defaultTextGroups) {
      this.textGroups.set(textGroup.id, textGroup);
    }
  }


  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash the password before storing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(insertUser.password, saltRounds);
    
    const userToInsert = {
      username: insertUser.username,
      password: hashedPassword, // Store hashed password
      role: insertUser.role || "user",
      isActive: true,
    };
    
    const result = await db.insert(users).values(userToInsert).returning();
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    // Hash password if it's being updated
    if (updates.password) {
      const saltRounds = 10;
      updates.password = await bcrypt.hash(updates.password, saltRounds);
    }

    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId)).returning();
    return result.length > 0;
  }

  async toggleUserStatus(userId: string): Promise<User | undefined> {
    // First get the current user
    const currentUser = await this.getUser(userId);
    if (!currentUser) return undefined;

    // Toggle the isActive status
    const result = await db.update(users)
      .set({ isActive: !currentUser.isActive })
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  // Authentication method - verify user credentials
  async authenticateUser(username: string, password: string): Promise<User | null> {
    console.log('🔐 AUTH: Attempting login for username:', username);
    const user = await this.getUserByUsername(username);
    
    if (!user) {
      console.log('❌ AUTH: User not found');
      return null;
    }
    
    if (!user.isActive) {
      console.log('❌ AUTH: User is inactive');
      return null;
    }
    
    console.log('🔑 AUTH: User found, verifying password...');
    console.log('🔑 AUTH: Provided password length:', password.length);
    console.log('🔑 AUTH: Stored hash starts with:', user.password.substring(0, 10));
    
    // Compare provided password with hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    console.log('🔑 AUTH: Password valid?', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ AUTH: Invalid password');
      return null; // Invalid password
    }
    
    console.log('✅ AUTH: Login successful for user:', username);
    // Return user without updating lastLogin since column doesn't exist in database
    return user;
  }

  // TV Token methods - for unauthenticated TV displays
  generateTvToken(userId: string): string {
    return generateTvToken(userId);
  }

  async getUserByTvToken(token: string): Promise<User | undefined> {
    // Get all users from database and check token match
    const allUsers = await this.getUsers();
    const userId = resolveUserIdFromToken(token, allUsers);
    return userId ? this.getUser(userId) : undefined;
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    const id = randomUUID();
    const now = new Date();
    const patient: Patient = {
      id,
      name: insertPatient.name || null,
      number: insertPatient.number,
      status: "waiting",
      isPriority: insertPatient.isPriority || false,
      priorityReason: insertPatient.priorityReason || null,
      windowId: null,
      lastWindowId: null,
      registeredAt: now,
      calledAt: null,
      completedAt: null,
      requeueReason: null,
      trackingHistory: [{
        timestamp: now.toISOString(),
        action: 'registered'
      }],
      archivedAt: null,
      userId: insertPatient.userId
    };
    this.patients.set(id, patient);
    return patient;
  }

  async getPatients(userId: string): Promise<Patient[]> {
    // Filter out archived patients (soft delete)
    return Array.from(this.patients.values()).filter(p => p.userId === userId && !p.archivedAt);
  }

  async getPatientsByDate(date: string, userId: string): Promise<Patient[]> {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    
    return Array.from(this.patients.values()).filter(
      (patient) => 
        patient.userId === userId &&
        !patient.archivedAt &&
        patient.registeredAt >= startOfDay && 
        patient.registeredAt <= endOfDay
    );
  }

  async getNextPatientNumber(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const todayPatients = await this.getPatientsByDate(today, userId);
    return todayPatients.length + 1;
  }

  async updatePatientStatus(patientId: string, status: string, userId: string, windowId?: string | null, requeueReason?: string): Promise<Patient | undefined> {
    const patient = this.patients.get(patientId);
    if (!patient || patient.userId !== userId) return undefined;

    const now = new Date();

    // Get existing tracking history as JSON array
    let trackingHistory: any[] = [];
    try {
      trackingHistory = Array.isArray(patient.trackingHistory) ? patient.trackingHistory : [];
    } catch (e) {
      trackingHistory = [];
    }
    
    // Add new journey event based on status change
    if (status === "called" && windowId) {
      const window = this.windows.get(windowId);
      // SECURITY: Ensure window belongs to same user to prevent cross-tenant access
      if (window && window.userId === userId) {
        trackingHistory.push({
          timestamp: now.toISOString(),
          action: 'called',
          roomName: window.name
        });
        patient.calledAt = now;
      } else if (windowId) {
        // Invalid window assignment - reject the operation
        return undefined;
      }
    } else if (status === "in-progress") {
      trackingHistory.push({
        timestamp: now.toISOString(),
        action: 'in-progress'
      });
    } else if (status === "completed") {
      trackingHistory.push({
        timestamp: now.toISOString(),
        action: 'completed'
      });
      patient.completedAt = now;
    } else if (status === "requeue") {
      // Get current room name before clearing
      const currentWindow = patient.windowId ? this.windows.get(patient.windowId) : null;
      trackingHistory.push({
        timestamp: now.toISOString(),
        action: 'requeued',
        requeueReason: requeueReason || 'No reason specified',
        fromRoom: currentWindow?.name || 'Unknown'
      });
    }

    // Preserve last window before clearing for completed/requeue status
    let lastWindowId = patient.lastWindowId;
    if ((status === "completed" || status === "requeue") && patient.windowId) {
      lastWindowId = patient.windowId;
    }

    // SECURITY: Validate windowId belongs to same user if provided
    if (windowId && windowId !== patient.windowId) {
      const window = this.windows.get(windowId);
      if (!window || window.userId !== userId) {
        return undefined; // Reject cross-tenant window assignment
      }
    }

    const updatedPatient = {
      ...patient,
      status,
      windowId: windowId === null ? null : (windowId || patient.windowId),
      lastWindowId: lastWindowId,
      requeueReason: status === "requeue" ? requeueReason || null : patient.requeueReason,
      trackingHistory: trackingHistory
    };

    this.patients.set(patientId, updatedPatient);
    return updatedPatient;
  }

  async togglePatientPriority(patientId: string, userId: string): Promise<Patient | undefined> {
    const patient = this.patients.get(patientId);
    if (!patient || patient.userId !== userId) return undefined;

    const updatedPatient = {
      ...patient,
      isPriority: !patient.isPriority
    };

    this.patients.set(patientId, updatedPatient);
    return updatedPatient;
  }

  async deletePatient(patientId: string, userId: string): Promise<boolean> {
    const patient = this.patients.get(patientId);
    if (!patient || patient.userId !== userId) return false;
    
    const deleted = this.patients.delete(patientId);
    
    // Remove patient from any windows (only user's windows)
    if (deleted) {
      this.windows.forEach((window, windowId) => {
        if (window.userId === userId && window.currentPatientId === patientId) {
          this.windows.set(windowId, { ...window, currentPatientId: undefined });
        }
      });
    }
    
    return deleted;
  }

  async archiveCompletedPatients(userId: string): Promise<number> {
    const allPatients = Array.from(this.patients.values()).filter(p => p.userId === userId);
    const completedPatients = allPatients.filter(p => p.status === "completed");
    
    let archivedCount = 0;
    const now = new Date();
    
    for (const patient of completedPatients) {
      const archivedPatient = {
        ...patient,
        archivedAt: now
      };
      this.patients.set(patient.id, archivedPatient);
      archivedCount++;
    }
    
    return archivedCount;
  }

  async deleteAllTodayPatients(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const todayPatients = await this.getPatientsByDate(today, userId);
    
    let deletedCount = 0;
    
    for (const patient of todayPatients) {
      const deleted = this.patients.delete(patient.id);
      if (deleted) {
        deletedCount++;
        
        // Remove patient from any windows
        this.windows.forEach((window, windowId) => {
          if (window.userId === userId && window.currentPatientId === patient.id) {
            this.windows.set(windowId, { ...window, currentPatientId: undefined });
          }
        });
      }
    }
    
    return deletedCount;
  }

  async getWindows(userId: string): Promise<Window[]> {
    const windows = Array.from(this.windows.values()).filter(w => w.userId === userId);
    
    // Enrich with patient details if currentPatientId exists
    return windows.map(w => {
      if (w.currentPatientId) {
        const patient = this.patients.get(w.currentPatientId);
        if (patient) {
          return {
            ...w,
            currentPatientName: patient.name || undefined,
            currentPatientNumber: patient.number
          };
        }
      }
      return w;
    });
  }

  async createWindow(insertWindow: InsertWindow): Promise<Window> {
    const id = randomUUID();
    const window: Window = {
      id,
      name: insertWindow.name.trim(),
      isActive: true,
      userId: insertWindow.userId
    };
    
    this.windows.set(id, window);
    return window;
  }

  async updateWindow(windowId: string, name: string, userId: string): Promise<Window | undefined> {
    const window = this.windows.get(windowId);
    if (!window || window.userId !== userId) return undefined;

    const updatedWindow = {
      ...window,
      name: name.trim()
    };

    this.windows.set(windowId, updatedWindow);
    return updatedWindow;
  }

  async deleteWindow(windowId: string, userId: string): Promise<boolean> {
    const window = this.windows.get(windowId);
    if (!window || window.userId !== userId) return false;

    // Check if window has a current patient - prevent deletion if occupied
    if (window.currentPatientId) {
      return false;
    }

    // Clear any patients assigned to this window (only user's patients)
    this.patients.forEach((patient, patientId) => {
      if (patient.userId === userId && patient.windowId === windowId) {
        this.patients.set(patientId, { ...patient, windowId: null });
      }
    });

    return this.windows.delete(windowId);
  }

  async toggleWindowStatus(windowId: string, userId: string): Promise<Window | undefined> {
    const window = this.windows.get(windowId);
    if (!window || window.userId !== userId) return undefined;

    const updatedWindow = {
      ...window,
      isActive: !window.isActive
    };

    this.windows.set(windowId, updatedWindow);
    return updatedWindow;
  }

  async updateWindowPatient(windowId: string, userId: string, patientId?: string): Promise<Window | undefined> {
    const window = this.windows.get(windowId);
    if (!window || window.userId !== userId) return undefined;

    // If assigning a patient, verify patient belongs to same user
    if (patientId) {
      const patient = this.patients.get(patientId);
      if (!patient || patient.userId !== userId) return undefined;
    }

    const updatedWindow = {
      ...window,
      currentPatientId: patientId
    };

    this.windows.set(windowId, updatedWindow);
    return updatedWindow;
  }

  async getDashboardStats(userId: string): Promise<{
    totalWaiting: number;
    totalCalled: number;
    totalCompleted: number;
    activeWindows: number;
    totalWindows: number;
  }> {
    const userPatients = Array.from(this.patients.values()).filter(p => p.userId === userId);
    const userWindows = Array.from(this.windows.values()).filter(w => w.userId === userId);
    
    // Get today's start and end boundaries (local timezone)
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const totalWaiting = userPatients.filter(p => p.status === 'waiting').length;
    const totalCalled = userPatients.filter(p => p.status === 'called').length;
    const totalCompleted = userPatients.filter(p => 
      p.status === 'completed' && 
      p.completedAt && 
      p.completedAt >= startOfDay && 
      p.completedAt <= endOfDay
    ).length;
    const activeWindows = userWindows.filter(w => w.isActive).length;
    const totalWindows = userWindows.length;

    return {
      totalWaiting,
      totalCalled,
      totalCompleted,
      activeWindows,
      totalWindows
    };
  }

  async getCurrentCall(userId: string): Promise<Patient | undefined> {
    // Get currently active called patient - only 'called' or 'in-progress' status
    // Exclude completed patients to prevent them from appearing as current call
    const calledPatients = Array.from(this.patients.values())
      .filter(p => p.userId === userId)
      .filter(p => p.status === 'called' || p.status === 'in-progress') // Only active calls
      .filter(p => p.calledAt) // Only patients that have actually been called
      .filter(p => !p.completedAt) // Exclude completed patients
      .sort((a, b) => {
        // Prioritize 'called' status over 'in-progress'
        if (a.status === 'called' && b.status !== 'called') return -1;
        if (b.status === 'called' && a.status !== 'called') return 1;
        
        // Then sort by most recent calledAt
        const timeA = a.calledAt?.getTime() || a.registeredAt.getTime();
        const timeB = b.calledAt?.getTime() || b.registeredAt.getTime();
        return timeB - timeA;
      });
    
    return calledPatients[0];
  }

  async getRecentHistory(userId: string, limit: number = 10): Promise<Patient[]> {
    // Get all patients that have been called - include requeued patients in history
    // Don't clear history even when patients are requeued
    return Array.from(this.patients.values())
      .filter(p => p.userId === userId)
      .filter(p => p.status === 'called' || p.status === 'completed' || p.status === 'requeue' || p.status === 'in-progress')
      .filter(p => p.calledAt) // Only include patients that have actually been called
      .sort((a, b) => {
        const timeA = a.calledAt?.getTime() || 0;
        const timeB = b.calledAt?.getTime() || 0;
        return timeB - timeA; // Most recent call first
      })
      .slice(0, limit);
  }

  // Settings methods implementation
  async getSettings(userId: string): Promise<Setting[]> {
    return Array.from(this.settings.values()).filter(s => s.userId === userId || s.userId === this.systemUserId);
  }

  async getSetting(key: string, userId: string): Promise<Setting | undefined> {
    // First try user-specific setting
    const userKey = `${userId}:${key}`;
    const userSetting = this.settings.get(userKey);
    if (userSetting) return userSetting;
    
    // Fallback to system default
    const systemKey = `${this.systemUserId}:${key}`;
    return this.settings.get(systemKey);
  }

  async getSettingsByCategory(category: string, userId: string): Promise<Setting[]> {
    return Array.from(this.settings.values()).filter(
      (setting) => setting.category === category && (setting.userId === userId || setting.userId === this.systemUserId)
    );
  }

  async setSetting(key: string, value: string, category: string, userId: string): Promise<Setting> {
    const setting: Setting = {
      id: randomUUID(),
      key,
      value,
      category,
      userId: userId,
    };
    const compositeKey = `${userId}:${key}`;
    this.settings.set(compositeKey, setting);
    return setting;
  }

  async updateSetting(key: string, value: string, userId: string): Promise<Setting | undefined> {
    // Only allow updating user's own settings, NOT system settings
    const userKey = `${userId}:${key}`;
    const existingSetting = this.settings.get(userKey);
    if (!existingSetting) {
      return undefined;
    }
    
    const updatedSetting: Setting = {
      ...existingSetting,
      value,
    };
    this.settings.set(userKey, updatedSetting);
    return updatedSetting;
  }

  async deleteSetting(key: string, userId: string): Promise<boolean> {
    // Only allow deleting user's own settings, NOT system settings
    const userKey = `${userId}:${key}`;
    const setting = this.settings.get(userKey);
    if (!setting) {
      return false;
    }
    return this.settings.delete(userKey);
  }

  // Media methods implementation
  async getMedia(userId: string): Promise<Media[]> {
    return Array.from(this.media.values()).filter(m => m.userId === userId);
  }

  async getMediaById(id: string, userId: string): Promise<Media | undefined> {
    const media = this.media.get(id);
    if (!media || media.userId !== userId) return undefined;
    return media;
  }

  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const id = randomUUID();
    const media: Media = {
      ...insertMedia,
      id,
      uploadedAt: new Date(),
      isActive: true,
    };
    this.media.set(id, media);
    return media;
  }

  async updateMedia(id: string, updates: Partial<Media>, userId: string): Promise<Media | undefined> {
    const media = this.media.get(id);
    if (!media || media.userId !== userId) return undefined;

    const updatedMedia = { ...media, ...updates };
    this.media.set(id, updatedMedia);
    return updatedMedia;
  }

  async deleteMedia(id: string, userId: string): Promise<boolean> {
    const media = this.media.get(id);
    if (!media || media.userId !== userId) return false;
    return this.media.delete(id);
  }

  async getActiveMedia(userId: string): Promise<Media[]> {
    return Array.from(this.media.values()).filter(media => media.userId === userId && media.isActive);
  }
  
  // Theme methods implementation
  async getThemes(userId: string): Promise<Theme[]> {
    return Array.from(this.themes.values()).filter(t => t.userId === userId || t.userId === this.systemUserId);
  }

  async getActiveTheme(userId: string): Promise<Theme | undefined> {
    // PRIORITY: First check for user's active theme, then system default
    const userActiveTheme = Array.from(this.themes.values()).find(theme => 
      theme.isActive && theme.userId === userId
    );
    if (userActiveTheme) return userActiveTheme;
    
    // Fallback to system active theme
    return Array.from(this.themes.values()).find(theme => 
      theme.isActive && theme.userId === this.systemUserId
    );
  }

  async getThemeById(id: string, userId: string): Promise<Theme | undefined> {
    const theme = this.themes.get(id);
    if (!theme || (theme.userId !== userId && theme.userId !== this.systemUserId)) return undefined;
    return theme;
  }

  async createTheme(insertTheme: InsertTheme): Promise<Theme> {
    const id = randomUUID();
    const theme: Theme = {
      name: "New Theme",
      primaryColor: "#3b82f6",
      secondaryColor: "#6b7280",
      callingColor: "#3b82f6",
      highlightBoxColor: "#ef4444",
      historyNameColor: "#6b7280",
      clinicNameColor: "#1f2937",
      modalBackgroundColor: "#1e293b",
      modalBorderColor: "#fbbf24",
      modalTextColor: "#ffffff",
      callingGradient: null,
      highlightBoxGradient: null,
      historyNameGradient: null,
      clinicNameGradient: null,
      backgroundColor: "#ffffff",
      backgroundGradient: null,
      accentColor: "#f3f4f6",
      ...insertTheme,
      id,
      isActive: false, // New themes are inactive by default
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.themes.set(id, theme);
    return theme;
  }

  async updateTheme(id: string, updates: Partial<Theme>, userId: string): Promise<Theme | undefined> {
    const theme = this.themes.get(id);
    // SECURITY: Only allow updating user's own themes, NEVER system themes
    if (!theme || theme.userId !== userId || theme.userId === this.systemUserId) return undefined;

    const updatedTheme = { 
      ...theme, 
      ...updates,
      updatedAt: new Date(),
    };
    this.themes.set(id, updatedTheme);
    return updatedTheme;
  }

  async deleteTheme(id: string, userId: string): Promise<boolean> {
    const theme = this.themes.get(id);
    // SECURITY: Only allow deleting user's own themes, NEVER system themes
    if (!theme || theme.userId !== userId || theme.userId === this.systemUserId) return false;
    
    // Don't allow deleting the active theme
    if (theme.isActive) return false;
    
    return this.themes.delete(id);
  }

  async setActiveTheme(id: string, userId: string): Promise<Theme | undefined> {
    const targetTheme = this.themes.get(id);
    if (!targetTheme || (targetTheme.userId !== userId && targetTheme.userId !== this.systemUserId)) return undefined;

    // If selecting system theme, clone it as user's active theme to avoid cross-tenant issues
    if (targetTheme.userId === this.systemUserId) {
      // Clone system theme as user's active theme
      const clonedTheme: Theme = {
        ...targetTheme,
        id: randomUUID(),
        name: `${targetTheme.name} (Copy)`,
        userId: userId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.themes.set(clonedTheme.id, clonedTheme);
      
      // Deactivate user's other themes only
      Array.from(this.themes.values())
        .filter(theme => theme.userId === userId && theme.id !== clonedTheme.id)
        .forEach(theme => {
          this.themes.set(theme.id, { ...theme, isActive: false });
        });
      
      return clonedTheme;
    } else {
      // Activating user's own theme - deactivate user's other themes only
      Array.from(this.themes.values())
        .filter(theme => theme.userId === userId && theme.id !== id)
        .forEach(theme => {
          this.themes.set(theme.id, { ...theme, isActive: false });
        });
      
      // Activate selected theme
      const updatedTheme = { ...targetTheme, isActive: true, updatedAt: new Date() };
      this.themes.set(id, updatedTheme);
      return updatedTheme;
    }
  }

  // Text Group methods implementation
  async getTextGroups(userId: string): Promise<TextGroup[]> {
    return Array.from(this.textGroups.values()).filter(tg => tg.userId === userId || tg.userId === this.systemUserId);
  }

  async getActiveTextGroups(userId: string): Promise<TextGroup[]> {
    return Array.from(this.textGroups.values()).filter(group => group.isActive && (group.userId === userId || group.userId === this.systemUserId));
  }

  async getTextGroupByName(groupName: string, userId: string): Promise<TextGroup | undefined> {
    return Array.from(this.textGroups.values()).find(group => group.groupName === groupName && (group.userId === userId || group.userId === this.systemUserId));
  }

  async getTextGroupById(id: string, userId: string): Promise<TextGroup | undefined> {
    const textGroup = this.textGroups.get(id);
    if (!textGroup || (textGroup.userId !== userId && textGroup.userId !== this.systemUserId)) return undefined;
    return textGroup;
  }

  async createTextGroup(insertTextGroup: InsertTextGroup): Promise<TextGroup> {
    const id = randomUUID();
    const textGroup: TextGroup = {
      id,
      groupName: insertTextGroup.groupName,
      displayName: insertTextGroup.displayName,
      description: insertTextGroup.description || null,
      color: insertTextGroup.color || "#ffffff",
      backgroundColor: insertTextGroup.backgroundColor || null,
      fontSize: insertTextGroup.fontSize || null,
      fontWeight: insertTextGroup.fontWeight || null,
      textAlign: insertTextGroup.textAlign || null,
      gradient: insertTextGroup.gradient || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: insertTextGroup.userId
    };
    this.textGroups.set(id, textGroup);
    return textGroup;
  }

  async updateTextGroup(id: string, updates: Partial<TextGroup>, userId: string): Promise<TextGroup | undefined> {
    const textGroup = this.textGroups.get(id);
    // SECURITY: Only allow updating user's own text groups, NOT system ones
    if (!textGroup || textGroup.userId !== userId) return undefined;

    const updatedTextGroup = { 
      ...textGroup, 
      ...updates,
      updatedAt: new Date(),
    };
    this.textGroups.set(id, updatedTextGroup);
    return updatedTextGroup;
  }

  async deleteTextGroup(id: string, userId: string): Promise<boolean> {
    const textGroup = this.textGroups.get(id);
    // SECURITY: Only allow deleting user's own text groups, NOT system ones
    if (!textGroup || textGroup.userId !== userId) return false;
    return this.textGroups.delete(id);
  }

  async toggleTextGroupStatus(id: string, userId: string): Promise<TextGroup | undefined> {
    const textGroup = this.textGroups.get(id);
    // SECURITY: Only allow toggling user's own text groups, NOT system ones  
    if (!textGroup || textGroup.userId !== userId) return undefined;

    const updatedTextGroup = {
      ...textGroup,
      isActive: !textGroup.isActive,
      updatedAt: new Date(),
    };

    this.textGroups.set(id, updatedTextGroup);
    return updatedTextGroup;
  }

  // QR Session methods
  async createQrSession(qrSession: InsertQrSession): Promise<QrSession> {
    const id = randomUUID();
    const session: QrSession = {
      id,
      tvVerifierHash: qrSession.tvVerifierHash,
      status: "pending",
      authorizedUserId: null,
      createdAt: new Date(),
      expiresAt: qrSession.expiresAt,
      usedAt: null,
      metadata: qrSession.metadata || {},
    };
    this.qrSessions.set(id, session);
    return session;
  }

  async getQrSession(id: string): Promise<QrSession | undefined> {
    const session = this.qrSessions.get(id);
    // Clean up expired sessions automatically
    if (session && session.expiresAt < new Date()) {
      this.qrSessions.delete(id);
      return undefined;
    }
    return session;
  }

  async authorizeQrSession(id: string, userId: string, tvVerifierHash?: string): Promise<QrSession | undefined> {
    const session = this.qrSessions.get(id);
    if (!session || session.status !== "pending" || session.expiresAt < new Date()) {
      return undefined;
    }

    const updatedSession = {
      ...session,
      status: "authorized" as const,
      authorizedUserId: userId,
      tvVerifierHash: tvVerifierHash || session.tvVerifierHash, // Update hash if provided
    };
    this.qrSessions.set(id, updatedSession);
    return updatedSession;
  }

  async finalizeQrSession(id: string, tvVerifier: string): Promise<{ success: boolean; userId?: string }> {
    const session = this.qrSessions.get(id);
    if (!session || session.status !== "authorized" || session.expiresAt < new Date()) {
      return { success: false };
    }

    // Verify tvVerifier hash
    const hash = createHash('sha256').update(tvVerifier).digest('hex');
    if (hash !== session.tvVerifierHash) {
      return { success: false };
    }

    // Mark as consumed
    const finalizedSession = {
      ...session,
      status: "consumed" as const,
      usedAt: new Date(),
    };
    this.qrSessions.set(id, finalizedSession);

    return { success: true, userId: session.authorizedUserId || undefined };
  }

  async expireOldQrSessions(): Promise<void> {
    const now = new Date();
    const expiredIds: string[] = [];
    
    this.qrSessions.forEach((session, id) => {
      if (session.expiresAt < now || (session.status === "consumed" && session.usedAt && now.getTime() - session.usedAt.getTime() > 60000)) {
        expiredIds.push(id);
      }
    });
    
    expiredIds.forEach(id => this.qrSessions.delete(id));
  }

}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  private systemUserId: string;

  constructor() {
    this.systemUserId = "system";
    this.initializeDefaultSettings();
    this.initializeDefaultTheme();
    this.initializeDefaultTextGroups();
    this.initializeDefaultWindows();
  }

  private async initializeDefaultSettings() {
    const defaultSettings = [
      { key: "mediaType", value: "image", category: "display" },
      { key: "theme", value: "blue", category: "display" },
      { key: "showPrayerTimes", value: "true", category: "display" },
      { key: "showWeather", value: "false", category: "display" },
      { key: "marqueeText", value: "Selamat datang ke Klinik Kesihatan", category: "display" },
      { key: "marqueeColor", value: "#ffffff", category: "display" },
      { key: "marqueeBackgroundColor", value: "#1e40af", category: "display" },
      { key: "enableSound", value: "true", category: "sound" },
      { key: "volume", value: "70", category: "sound" },
      { key: "soundMode", value: "preset", category: "sound" },
      { key: "presetKey", value: "airport_call", category: "sound" }
    ];

    for (const setting of defaultSettings) {
      const existing = await db.select().from(schema.settings)
        .where(eq(schema.settings.key, setting.key))
        .limit(1);
      
      if (existing.length === 0) {
        await this.setSetting(setting.key, setting.value, setting.category, this.systemUserId);
      }
    }
  }

  private async initializeDefaultTheme() {
    const existing = await db.select().from(schema.themes)
      .where(eq(schema.themes.isActive, true))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.themes).values({
        name: "Default Theme",
        isActive: true,
        primaryColor: "#3b82f6",
        secondaryColor: "#6b7280",
        callingColor: "#3b82f6",
        highlightBoxColor: "#ef4444",
        historyNameColor: "#6b7280",
        clinicNameColor: "#1f2937",
        modalBackgroundColor: "#1e293b",
        modalBorderColor: "#fbbf24",
        modalTextColor: "#ffffff",
        callingGradient: null,
        highlightBoxGradient: null,
        historyNameGradient: null,
        clinicNameGradient: null,
        backgroundColor: "#ffffff",
        backgroundGradient: null,
        accentColor: "#f3f4f6",
        userId: this.systemUserId,
      });
    }
  }

  private async initializeDefaultTextGroups() {
    const defaultTextGroups = [
      { groupName: "clinic_name", displayName: "Clinic Name", color: "#ffffff" },
      { groupName: "patient_name", displayName: "Patient Name", color: "#facc15" },
      { groupName: "window_name", displayName: "Window Name", color: "#facc15" },
    ];

    for (const group of defaultTextGroups) {
      const existing = await db.select().from(schema.textGroups)
        .where(and(
          eq(schema.textGroups.groupName, group.groupName),
          eq(schema.textGroups.userId, this.systemUserId)
        ))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.textGroups).values({
          ...group,
          userId: this.systemUserId,
        });
      }
    }
  }

  private async initializeDefaultWindows() {
    // Get all users to ensure each has DISPENSARY room
    const allUsers = await db.select().from(users);
    
    for (const user of allUsers) {
      // Check if DISPENSARY room exists for this user
      const existing = await db.select().from(schema.windows)
        .where(and(
          eq(schema.windows.name, "DISPENSARY"),
          eq(schema.windows.userId, user.id)
        ))
        .limit(1);

      if (existing.length === 0) {
        // Create DISPENSARY room for this user
        await db.insert(schema.windows).values({
          name: "DISPENSARY",
          isActive: true,
          isPermanent: true,
          userId: user.id,
        });
      } else if (!existing[0].isPermanent) {
        // Update existing DISPENSARY to be permanent
        await db.update(schema.windows)
          .set({ isPermanent: true })
          .where(eq(schema.windows.id, existing[0].id));
      }
    }
  }

  // Settings methods
  async getSettings(userId: string): Promise<Setting[]> {
    return await db.select().from(schema.settings).where(eq(schema.settings.userId, userId));
  }

  async getSetting(key: string, userId: string): Promise<Setting | undefined> {
    const result = await db.select().from(schema.settings)
      .where(and(eq(schema.settings.key, key), eq(schema.settings.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getSettingsByCategory(category: string, userId: string): Promise<Setting[]> {
    return await db.select().from(schema.settings)
      .where(and(eq(schema.settings.category, category), eq(schema.settings.userId, userId)));
  }

  async setSetting(key: string, value: string, category: string, userId: string): Promise<Setting> {
    const setting = {
      key,
      value,
      category,
      userId,
    };
    
    const result = await db.insert(schema.settings)
      .values(setting)
      .returning();
    return result[0];
  }

  async updateSetting(key: string, value: string, userId: string): Promise<Setting | undefined> {
    const result = await db.update(schema.settings)
      .set({ value })
      .where(and(eq(schema.settings.key, key), eq(schema.settings.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteSetting(key: string, userId: string): Promise<boolean> {
    const result = await db.delete(schema.settings)
      .where(and(eq(schema.settings.key, key), eq(schema.settings.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Implement all other methods from MemStorage but using database operations
  // For now, I'll delegate to MemStorage for non-settings methods
  private memStorage = new MemStorage();

  // User methods - use database directly for persistence
  async getUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result;
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash the password before storing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(insertUser.password, saltRounds);
    
    const userToInsert = {
      username: insertUser.username,
      password: hashedPassword,
      role: insertUser.role || "user",
      isActive: true,
    };
    
    const result = await db.insert(users).values(userToInsert).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    // Hash password if it's being updated
    if (updates.password) {
      const saltRounds = 10;
      updates.password = await bcrypt.hash(updates.password, saltRounds);
    }

    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async authenticateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    
    if (!user || !user.isActive) {
      return null;
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return null;
    }
    
    return user;
  }

  async toggleUserStatus(id: string): Promise<User | undefined> {
    const currentUser = await this.getUser(id);
    if (!currentUser) return undefined;

    const result = await db.update(users)
      .set({ isActive: !currentUser.isActive })
      .where(eq(users.id, id))
      .returning();
    
    return result[0];
  }

  // TV Token methods - use database query for efficiency
  generateTvToken(userId: string): string {
    return generateTvToken(userId);
  }

  async getUserByTvToken(token: string): Promise<User | undefined> {
    // Get all users from database and check token match
    const allUsers = await this.getUsers();
    const userId = resolveUserIdFromToken(token, allUsers);
    return userId ? this.getUser(userId) : undefined;
  }

  // Window methods  
  async getWindows(userId: string): Promise<Window[]> {
    // For now, use database for windows to ensure persistence
    try {
      const result = await db
        .select({
          id: schema.windows.id,
          name: schema.windows.name,
          isActive: schema.windows.isActive,
          currentPatientId: schema.windows.currentPatientId,
          userId: schema.windows.userId,
          patientName: schema.patients.name,
          patientNumber: schema.patients.number,
        })
        .from(schema.windows)
        .leftJoin(schema.patients, eq(schema.windows.currentPatientId, schema.patients.id))
        .where(eq(schema.windows.userId, userId));
      
      return result.map(w => ({
        id: w.id,
        name: w.name,
        isActive: w.isActive,
        currentPatientId: w.currentPatientId || undefined,
        currentPatientName: w.patientName || undefined,
        currentPatientNumber: w.patientNumber || undefined,
        userId: w.userId
      }));
    } catch (error) {
      console.error('Database error, falling back to memory storage:', error);
      return this.memStorage.getWindows(userId);
    }
  }

  async getWindow(id: string): Promise<Window | undefined> {
    const result = await db.select().from(schema.windows).where(eq(schema.windows.id, id));
    if (result.length === 0) return undefined;
    const w = result[0];
    return {
      id: w.id,
      name: w.name,
      isActive: w.isActive,
      isPermanent: w.isPermanent,
      currentPatientId: w.currentPatientId || undefined,
      userId: w.userId
    };
  }

  async createWindow(insertWindow: InsertWindow): Promise<Window> {
    const windowId = randomUUID();
    const windowData = {
      id: windowId,
      name: insertWindow.name,
      isActive: true,
      currentPatientId: null,
      userId: insertWindow.userId
    };
    
    await db.insert(schema.windows).values(windowData);
    
    return {
      id: windowId,
      name: insertWindow.name,
      isActive: true,
      currentPatientId: undefined,
      userId: insertWindow.userId
    };
  }

  async updateWindow(windowId: string, name: string, userId: string): Promise<Window | undefined> {
    const result = await db.update(schema.windows)
      .set({ name })
      .where(and(eq(schema.windows.id, windowId), eq(schema.windows.userId, userId)))
      .returning();
    
    if (result.length === 0) return undefined;
    const w = result[0];
    return {
      id: w.id,
      name: w.name,
      isActive: w.isActive,
      currentPatientId: w.currentPatientId || undefined,
      userId: w.userId
    };
  }

  async deleteWindow(windowId: string, userId: string): Promise<boolean> {
    const result = await db.delete(schema.windows)
      .where(and(eq(schema.windows.id, windowId), eq(schema.windows.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async toggleWindowStatus(windowId: string, userId: string): Promise<Window | undefined> {
    // First check if window belongs to user
    const current = await db.select().from(schema.windows)
      .where(and(eq(schema.windows.id, windowId), eq(schema.windows.userId, userId)))
      .limit(1);
    
    if (current.length === 0) return undefined;
    
    const result = await db.update(schema.windows)
      .set({ isActive: !current[0].isActive })
      .where(and(eq(schema.windows.id, windowId), eq(schema.windows.userId, userId)))
      .returning();
    
    if (result.length === 0) return undefined;
    const w = result[0];
    return {
      id: w.id,
      name: w.name,
      isActive: w.isActive,
      currentPatientId: w.currentPatientId || undefined,
      userId: w.userId
    };
  }

  async updateWindowPatient(windowId: string, userId: string, patientId?: string): Promise<Window | undefined> {
    // SECURITY: Verify window belongs to user to prevent cross-tenant access
    const window = await this.getWindow(windowId);
    if (!window || window.userId !== userId) return undefined;

    // SECURITY: If assigning a patient, verify patient belongs to same user
    if (patientId) {
      const patient = await this.getPatient(patientId);
      if (!patient || patient.userId !== userId) return undefined;
    }

    const result = await db.update(schema.windows)
      .set({ currentPatientId: patientId || null })
      .where(eq(schema.windows.id, windowId))
      .returning();
    
    if (result.length === 0) return undefined;
    const w = result[0];
    return {
      id: w.id,
      name: w.name,
      isActive: w.isActive,
      currentPatientId: w.currentPatientId || undefined,
      userId: w.userId
    };
  }

  // Patient methods (using memStorage for now due to type complexity)
  async getPatients(userId: string): Promise<Patient[]> {
    // Filter out archived patients (soft delete)
    return await db.select().from(schema.patients)
      .where(
        and(
          eq(schema.patients.userId, userId),
          sql`${schema.patients.archivedAt} IS NULL`
        )
      );
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(schema.patients).where(eq(schema.patients.id, id));
    return patient;
  }

  async getPatientsByDate(date: string, userId: string): Promise<Patient[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await db.select().from(schema.patients)
      .where(
        and(
          eq(schema.patients.userId, userId),
          sql`${schema.patients.archivedAt} IS NULL`,
          sql`${schema.patients.registeredAt} >= ${startOfDay.toISOString()}`,
          sql`${schema.patients.registeredAt} <= ${endOfDay.toISOString()}`
        )
      );
  }

  async getNextPatientNumber(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db.select({ maxNumber: sql`COALESCE(MAX(${schema.patients.number}), 0)` })
      .from(schema.patients)
      .where(
        and(
          eq(schema.patients.userId, userId),
          sql`${schema.patients.registeredAt} >= ${startOfDay.toISOString()}`,
          sql`${schema.patients.registeredAt} <= ${endOfDay.toISOString()}`
        )
      );

    return (result[0]?.maxNumber as number || 0) + 1;
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    const now = new Date();
    const trackingHistory = [{
      timestamp: now.toISOString(),
      action: 'registered'
    }];
    const patientData = {
      ...insertPatient,
      trackingHistory: sql`${JSON.stringify(trackingHistory)}::json`
    };
    const [patient] = await db.insert(schema.patients).values(patientData).returning();
    return patient;
  }

  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | undefined> {
    // MemStorage doesn't have updatePatient, so return undefined for now
    return undefined;
  }

  async updatePatientStatus(id: string, status: string, userId: string, windowId?: string | null, requeueReason?: string): Promise<Patient | undefined> {
    // Get current patient data first
    const [currentPatient] = await db.select()
      .from(schema.patients)
      .where(and(eq(schema.patients.id, id), eq(schema.patients.userId, userId)));
    
    if (!currentPatient) {
      return undefined;
    }

    const now = new Date();
    
    // Get existing tracking history as JSON array
    let trackingHistory: any[] = [];
    try {
      trackingHistory = Array.isArray(currentPatient.trackingHistory) ? currentPatient.trackingHistory : [];
    } catch (e) {
      trackingHistory = [];
    }

    // Add new journey event based on status change
    if (status === "called" && windowId) {
      const [window] = await db.select()
        .from(schema.windows)
        .where(and(eq(schema.windows.id, windowId), eq(schema.windows.userId, userId)));
      
      if (window) {
        trackingHistory.push({
          timestamp: now.toISOString(),
          action: 'called',
          roomName: window.name
        });
      }
    } else if (status === "dispensary") {
      // Special handling for dispensary - auto-find DISPENSARY window
      const [dispensaryWindow] = await db.select()
        .from(schema.windows)
        .where(and(
          eq(schema.windows.name, 'DISPENSARY'),
          eq(schema.windows.userId, userId)
        ));
      
      if (dispensaryWindow) {
        trackingHistory.push({
          timestamp: now.toISOString(),
          action: 'called',
          roomName: 'DISPENSARY'
        });
      }
    } else if (status === "in-progress") {
      trackingHistory.push({
        timestamp: now.toISOString(),
        action: 'in-progress'
      });
    } else if (status === "completed") {
      trackingHistory.push({
        timestamp: now.toISOString(),
        action: 'completed'
      });
    } else if (status === "requeue") {
      // Get current room name before clearing
      let fromRoom = 'Unknown';
      if (currentPatient.windowId) {
        const [currentWindow] = await db.select()
          .from(schema.windows)
          .where(and(eq(schema.windows.id, currentPatient.windowId), eq(schema.windows.userId, userId)));
        fromRoom = currentWindow?.name || 'Unknown';
      }
      
      trackingHistory.push({
        timestamp: now.toISOString(),
        action: 'requeued',
        requeueReason: requeueReason || 'No reason specified',
        fromRoom: fromRoom
      });
    }
    
    // Special handling for "dispensary" status - just queue patient, don't auto-call
    if (status === "dispensary") {
      // Clear patient from window FIRST (before clearing patient.windowId)
      if (currentPatient.windowId) {
        await db.update(schema.windows)
          .set({ currentPatientId: null })
          .where(and(
            eq(schema.windows.id, currentPatient.windowId),
            eq(schema.windows.userId, userId)
          ));
      }
      
      const updateData: any = { 
        status: "dispensary", // Keep status as "dispensary" (not auto-called)
        windowId: null, // Clear current room
        lastWindowId: currentPatient.windowId, // Preserve previous room
        requeueReason: null,
        trackingHistory: sql`${JSON.stringify(trackingHistory)}::json`
      };

      const [updatedPatient] = await db.update(schema.patients)
        .set(updateData)
        .where(and(eq(schema.patients.id, id), eq(schema.patients.userId, userId)))
        .returning();

      console.log(`💊 DISPENSARY queued (not called):`, {
        id: updatedPatient?.id,
        name: updatedPatient?.name,
        status: updatedPatient?.status,
        windowId: updatedPatient?.windowId,
        lastWindowId: updatedPatient?.lastWindowId
      });

      return updatedPatient;
    }
    
    // Special handling for "completed" and "requeue" status - preserve current room to lastWindowId
    if (status === "completed" || status === "requeue") {
      console.log(`🔄 ${status.toUpperCase()}: Preserving windowId`, {
        patientId: id,
        currentWindowId: currentPatient.windowId,
        willSetLastWindowId: currentPatient.windowId
      });
      
      // Clear patient from window FIRST (before clearing patient.windowId)
      if (currentPatient.windowId) {
        await db.update(schema.windows)
          .set({ currentPatientId: null })
          .where(and(
            eq(schema.windows.id, currentPatient.windowId),
            eq(schema.windows.userId, userId)
          ));
      }
      
      const updateData: any = { 
        status,
        windowId: null, // Clear current room
        lastWindowId: currentPatient.windowId, // Preserve current room as last room
        requeueReason: requeueReason || null,
        trackingHistory: sql`${JSON.stringify(trackingHistory)}::json`
      };

      // Only set completedAt for "completed" status
      if (status === "completed") {
        updateData.completedAt = now;
      }

      const [updatedPatient] = await db.update(schema.patients)
        .set(updateData)
        .where(and(eq(schema.patients.id, id), eq(schema.patients.userId, userId)))
        .returning();

      console.log(`✅ ${status.toUpperCase()} updated:`, {
        id: updatedPatient?.id,
        name: updatedPatient?.name,
        status: updatedPatient?.status,
        windowId: updatedPatient?.windowId,
        lastWindowId: updatedPatient?.lastWindowId,
        requeueReason: updatedPatient?.requeueReason
      });

      return updatedPatient;
    }
    
    // Normal handling for other statuses
    const updateData: any = { 
      status,
      windowId: windowId || null,
      requeueReason: requeueReason || null,
      trackingHistory: sql`${JSON.stringify(trackingHistory)}::json`
    };

    // CRITICAL: ALWAYS update calledAt when status is "called" (including recalls)
    // This ensures TV display detects the change and triggers highlight overlay
    if (status === "called") {
      updateData.calledAt = now;
      console.log(`📞 CALLING PATIENT: ${id} - New calledAt: ${now.toISOString()}`);
    }

    const [updatedPatient] = await db.update(schema.patients)
      .set(updateData)
      .where(and(eq(schema.patients.id, id), eq(schema.patients.userId, userId)))
      .returning();

    console.log(`✅ Patient status updated:`, {
      id: updatedPatient?.id,
      name: updatedPatient?.name,
      status: updatedPatient?.status,
      calledAt: updatedPatient?.calledAt?.toISOString(),
      windowId: updatedPatient?.windowId
    });

    return updatedPatient;
  }

  async togglePatientPriority(patientId: string, userId: string): Promise<Patient | undefined> {
    const patient = await db.query.patients.findFirst({
      where: and(
        eq(schema.patients.id, patientId),
        eq(schema.patients.userId, userId)
      )
    });

    if (!patient) return undefined;

    const [updatedPatient] = await db.update(schema.patients)
      .set({ isPriority: !patient.isPriority })
      .where(and(eq(schema.patients.id, patientId), eq(schema.patients.userId, userId)))
      .returning();

    return updatedPatient;
  }

  async deletePatient(patientId: string, userId: string): Promise<boolean> {
    const result = await db.delete(schema.patients)
      .where(and(eq(schema.patients.id, patientId), eq(schema.patients.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async archiveCompletedPatients(userId: string): Promise<number> {
    // Soft delete completed patients by setting archivedAt timestamp
    const result = await db.update(schema.patients)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(schema.patients.userId, userId),
          eq(schema.patients.status, "completed"),
          sql`${schema.patients.archivedAt} IS NULL`
        )
      );
    return result.rowCount || 0;
  }

  async deleteAllTodayPatients(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Delete all today's patients (hard delete)
    const result = await db.delete(schema.patients)
      .where(
        and(
          eq(schema.patients.userId, userId),
          sql`${schema.patients.registeredAt} >= ${startOfDay.toISOString()}`,
          sql`${schema.patients.registeredAt} <= ${endOfDay.toISOString()}`
        )
      );
    
    return result.rowCount || 0;
  }

  // Media methods
  async getMedia(userId: string): Promise<Media[]> {
    return await db.select().from(schema.media).where(eq(schema.media.userId, userId));
  }

  async getMediaById(id: string, userId: string): Promise<Media | undefined> {
    const [media] = await db.select().from(schema.media)
      .where(and(eq(schema.media.id, id), eq(schema.media.userId, userId)));
    return media;
  }

  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const [media] = await db.insert(schema.media).values(insertMedia).returning();
    return media;
  }

  async updateMedia(id: string, updates: Partial<Media>, userId: string): Promise<Media | undefined> {
    const [updatedMedia] = await db.update(schema.media)
      .set(updates)
      .where(and(eq(schema.media.id, id), eq(schema.media.userId, userId)))
      .returning();
    return updatedMedia;
  }

  async deleteMedia(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(schema.media)
      .where(and(eq(schema.media.id, id), eq(schema.media.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getActiveMedia(userId: string): Promise<Media[]> {
    return await db.select().from(schema.media)
      .where(and(eq(schema.media.isActive, true), eq(schema.media.userId, userId)));
  }

  // Theme methods
  async getThemes(userId: string): Promise<Theme[]> {
    return this.memStorage.getThemes(userId);
  }

  async getActiveTheme(userId: string): Promise<Theme | undefined> {
    return this.memStorage.getActiveTheme(userId);
  }

  async getThemeById(id: string, userId: string): Promise<Theme | undefined> {
    return this.memStorage.getThemeById(id, userId);
  }

  async createTheme(insertTheme: InsertTheme): Promise<Theme> {
    return this.memStorage.createTheme(insertTheme);
  }

  async updateTheme(id: string, updates: Partial<Theme>, userId: string): Promise<Theme | undefined> {
    return this.memStorage.updateTheme(id, updates, userId);
  }

  async deleteTheme(id: string, userId: string): Promise<boolean> {
    return this.memStorage.deleteTheme(id, userId);
  }

  async setActiveTheme(id: string, userId: string): Promise<Theme | undefined> {
    return this.memStorage.setActiveTheme(id, userId);
  }

  // Text Group methods
  async getTextGroups(userId: string): Promise<TextGroup[]> {
    return this.memStorage.getTextGroups(userId);
  }

  async getActiveTextGroups(userId: string): Promise<TextGroup[]> {
    return this.memStorage.getActiveTextGroups(userId);
  }

  async getTextGroupByName(groupName: string, userId: string): Promise<TextGroup | undefined> {
    return this.memStorage.getTextGroupByName(groupName, userId);
  }

  async getTextGroupById(id: string, userId: string): Promise<TextGroup | undefined> {
    return this.memStorage.getTextGroupById(id, userId);
  }

  async createTextGroup(insertTextGroup: InsertTextGroup): Promise<TextGroup> {
    return this.memStorage.createTextGroup(insertTextGroup);
  }

  async updateTextGroup(id: string, updates: Partial<TextGroup>, userId: string): Promise<TextGroup | undefined> {
    return this.memStorage.updateTextGroup(id, updates, userId);
  }

  async deleteTextGroup(id: string, userId: string): Promise<boolean> {
    return this.memStorage.deleteTextGroup(id, userId);
  }

  async toggleTextGroupStatus(id: string, userId: string): Promise<TextGroup | undefined> {
    return this.memStorage.toggleTextGroupStatus(id, userId);
  }

  // Dashboard methods
  async getDashboardStats(userId: string): Promise<{
    totalWaiting: number;
    totalCalled: number;
    totalCompleted: number;
    activeWindows: number;
    totalWindows: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const patients = await db.select().from(schema.patients)
      .where(
        and(
          eq(schema.patients.userId, userId),
          sql`${schema.patients.registeredAt} >= ${startOfDay.toISOString()}`,
          sql`${schema.patients.registeredAt} <= ${endOfDay.toISOString()}`
        )
      );

    const windows = await this.getWindows(userId);

    return {
      totalWaiting: patients.filter(p => p.status === "waiting").length,
      totalCalled: patients.filter(p => p.status === "called").length,
      totalCompleted: patients.filter(p => p.status === "completed").length,
      activeWindows: windows.filter(w => w.isActive && w.currentPatientId).length,
      totalWindows: windows.filter(w => w.isActive).length
    };
  }

  async getCurrentCall(userId: string): Promise<Patient | undefined> {
    // Get the most recent called patient regardless of status (completed, dispensary, etc.)
    // This keeps the display showing last called patient until a NEW patient is called
    const [result] = await db
      .select({
        id: schema.patients.id,
        name: schema.patients.name,
        number: schema.patients.number,
        status: schema.patients.status,
        isPriority: schema.patients.isPriority,
        priorityReason: schema.patients.priorityReason,
        windowId: schema.patients.windowId,
        lastWindowId: schema.patients.lastWindowId,
        registeredAt: schema.patients.registeredAt,
        calledAt: schema.patients.calledAt,
        completedAt: schema.patients.completedAt,
        requeueReason: schema.patients.requeueReason,
        trackingHistory: schema.patients.trackingHistory,
        archivedAt: schema.patients.archivedAt,
        userId: schema.patients.userId,
        // Get room name - use current window if available, otherwise last window
        room: sql<string>`COALESCE(${schema.windows.name}, lw.name)`,
      })
      .from(schema.patients)
      .leftJoin(schema.windows, eq(schema.patients.windowId, schema.windows.id))
      .leftJoin(sql`${schema.windows} lw`, eq(schema.patients.lastWindowId, sql`lw.id`))
      .where(and(
        eq(schema.patients.userId, userId),
        sql`${schema.patients.calledAt} IS NOT NULL` // Only patients that have been called
      ))
      .orderBy(sql`${schema.patients.calledAt} DESC`) // Most recent call first
      .limit(1);
    
    console.log("🔍 getCurrentCall raw result:", result);
    
    const finalResult = result ? {
      ...result,
      windowName: result.room || undefined
    } as Patient & { room?: string } : undefined;
    
    console.log("🔍 getCurrentCall final result:", finalResult);
    return finalResult;
  }

  async getRecentHistory(userId: string, limit: number = 10): Promise<Patient[]> {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get current call
    const currentCall = await this.getCurrentCall(userId);

    // Get all patients that have been called today with their tracking history
    const patients = await db.select({
      id: schema.patients.id,
      name: schema.patients.name,
      number: schema.patients.number,
      status: schema.patients.status,
      isPriority: schema.patients.isPriority,
      priorityReason: schema.patients.priorityReason,
      windowId: schema.patients.windowId,
      lastWindowId: schema.patients.lastWindowId,
      registeredAt: schema.patients.registeredAt,
      calledAt: schema.patients.calledAt,
      completedAt: schema.patients.completedAt,
      requeueReason: schema.patients.requeueReason,
      trackingHistory: schema.patients.trackingHistory,
      archivedAt: schema.patients.archivedAt,
      userId: schema.patients.userId,
    }).from(schema.patients)
      .where(
        and(
          eq(schema.patients.userId, userId),
          sql`${schema.patients.calledAt} IS NOT NULL`,
          sql`${schema.patients.calledAt} >= ${startOfDay.toISOString()}`,
          sql`${schema.patients.calledAt} <= ${endOfDay.toISOString()}`
        )
      );

    // Extract ALL call events from trackingHistory - each call becomes a separate history entry
    const callEvents: Array<Patient & { room?: string; calledAt: Date }> = [];
    
    for (const patient of patients) {
      if (patient.trackingHistory && Array.isArray(patient.trackingHistory)) {
        // Find all 'called' events in tracking history
        const callHistory = patient.trackingHistory.filter((event: any) => event.action === 'called');
        
        for (const callEvent of callHistory) {
          callEvents.push({
            ...patient,
            room: callEvent.roomName || 'Unknown Room',
            calledAt: new Date(callEvent.timestamp) // Use the specific call timestamp
          });
        }
      }
    }

    // Sort by call timestamp (most recent first)
    const sortedHistory = callEvents
      .sort((a, b) => b.calledAt.getTime() - a.calledAt.getTime())
      .filter((event, index, self) => {
        // Exclude current call from history (keep it in current display only)
        if (currentCall && event.id === currentCall.id && event.calledAt.getTime() === new Date(currentCall.calledAt || '').getTime()) {
          return false;
        }
        return true;
      })
      .slice(0, limit);

    return sortedHistory;
  }

  // QR Session methods
  async createQrSession(qrSession: InsertQrSession): Promise<QrSession> {
    const result = await db.insert(schema.qrSessions)
      .values(qrSession)
      .returning();
    return result[0];
  }

  async getQrSession(id: string): Promise<QrSession | undefined> {
    const [session] = await db.select().from(schema.qrSessions)
      .where(eq(schema.qrSessions.id, id));
    
    // Clean up expired sessions automatically
    if (session && session.expiresAt < new Date()) {
      await db.delete(schema.qrSessions).where(eq(schema.qrSessions.id, id));
      return undefined;
    }
    return session;
  }

  async authorizeQrSession(id: string, userId: string, tvVerifierHash?: string): Promise<QrSession | undefined> {
    const session = await this.getQrSession(id);
    if (!session || session.status !== "pending" || session.expiresAt < new Date()) {
      return undefined;
    }

    const updateData: any = { 
      status: "authorized",
      authorizedUserId: userId
    };
    
    // Update tvVerifierHash if provided
    if (tvVerifierHash) {
      updateData.tvVerifierHash = tvVerifierHash;
    }

    const result = await db.update(schema.qrSessions)
      .set(updateData)
      .where(eq(schema.qrSessions.id, id))
      .returning();
    
    return result[0];
  }

  async finalizeQrSession(id: string, tvVerifier: string): Promise<{ success: boolean; userId?: string }> {
    const session = await this.getQrSession(id);
    if (!session || session.status !== "authorized" || session.expiresAt < new Date()) {
      return { success: false };
    }

    // Verify tvVerifier hash
    const hash = createHash('sha256').update(tvVerifier).digest('hex');
    if (hash !== session.tvVerifierHash) {
      return { success: false };
    }

    // Mark as consumed
    const result = await db.update(schema.qrSessions)
      .set({ 
        status: "consumed",
        usedAt: new Date()
      })
      .where(eq(schema.qrSessions.id, id))
      .returning();

    return { success: true, userId: session.authorizedUserId || undefined };
  }

  async expireOldQrSessions(): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    // Delete expired sessions or consumed sessions older than 1 minute
    await db.delete(schema.qrSessions)
      .where(
        sql`${schema.qrSessions.expiresAt} < ${now.toISOString()} OR (${schema.qrSessions.status} = 'consumed' AND ${schema.qrSessions.usedAt} < ${oneMinuteAgo.toISOString()})`
      );
  }
}

export const storage = new DatabaseStorage();
