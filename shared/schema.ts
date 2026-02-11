import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'admin' or 'user'
  isActive: boolean("is_active").notNull().default(true),
  tvPin: varchar("tv_pin", { length: 6 }).unique(),
});

// User sessions table (legacy - preserved to avoid data loss)
export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// QR authentication sessions table
export const qrSessions = pgTable("qr_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tvVerifierHash: text("tv_verifier_hash").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'authorized', 'consumed', 'expired'
  authorizedUserId: varchar("authorized_user_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  metadata: json("metadata").default(sql`'{}'::json`),
});

// Windows/Rooms table
export const windows = pgTable("windows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isPermanent: boolean("is_permanent").notNull().default(false), // Cannot be deleted
  currentPatientId: varchar("current_patient_id"),
  // Account isolation
  userId: varchar("user_id").notNull(),
});

// Patients/Queue table
export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"), // Can be null for number-only patients
  number: integer("number").notNull(),
  status: text("status").notNull().default("waiting"), // 'waiting', 'called', 'in-progress', 'completed', 'requeue', 'dispensary'
  isPriority: boolean("is_priority").notNull().default(false), // Priority patient flag
  priorityReason: text("priority_reason"), // Reason for priority status
  readyForDispensary: boolean("ready_for_dispensary").notNull().default(false), // Patient ready for dispensary (status/window remain unchanged)
  windowId: varchar("window_id"),
  lastWindowId: varchar("last_window_id"), // Preserve last room they were called to
  registeredAt: timestamp("registered_at").notNull().default(sql`now()`),
  calledAt: timestamp("called_at"),
  completedAt: timestamp("completed_at"),
  requeueReason: text("requeue_reason"), // Reason for requeue: NEBULISER, AMBIL UBATAN, MENUNGGU KEPUTUSAN UJIAN, MGTT
  trackingHistory: json("tracking_history").default(sql`'[]'::json`), // JSON array of journey events: {timestamp, action, roomName?, requeueReason?}
  archivedAt: timestamp("archived_at"), // Soft delete timestamp for queue reset (24-hour clinics)
  // Account isolation
  userId: varchar("user_id").notNull(),
});

// Settings table
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull(),
  value: text("value").notNull(),
  category: text("category").notNull(), // 'display', 'sound', 'general'
  // Account isolation - unique key per user
  userId: varchar("user_id").notNull(),
});

// Media files table
export const media = pgTable("media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  filename: text("filename").notNull(), // Original filename
  url: text("url"), // Legacy: Storage URL/path (nullable for database-stored files)
  data: text("data"), // Base64-encoded file data stored in database
  type: text("type").notNull(), // 'image', 'video', or 'audio'
  mimeType: text("mime_type").notNull(), // e.g., 'image/jpeg', 'video/mp4', 'audio/mpeg'
  size: integer("size").notNull(), // File size in bytes
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
  isActive: boolean("is_active").notNull().default(true),
  // Account isolation
  userId: varchar("user_id").notNull(),
});


// Text Groups table for organizing text elements
export const textGroups = pgTable("text_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupName: text("group_name").notNull(), // e.g., 'clinic_name', 'location_display', etc
  displayName: text("display_name").notNull(), // Human readable name
  description: text("description"), // Optional description
  color: text("color").notNull().default("#ffffff"), // Text color
  backgroundColor: text("background_color"), // Optional background color
  fontSize: text("font_size"), // Optional custom font size
  fontWeight: text("font_weight"), // Optional font weight
  textAlign: text("text_align"), // Optional text alignment
  gradient: text("gradient"), // Optional gradient definition
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  // Account isolation - unique groupName per user
  userId: varchar("user_id").notNull(),
});

// Theme colors table
export const themes = pgTable("themes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default("Default Theme"),
  isActive: boolean("is_active").notNull().default(true),
  // Main theme colors
  primaryColor: text("primary_color").notNull().default("#3b82f6"),
  secondaryColor: text("secondary_color").notNull().default("#6b7280"),
  // Specific UI element colors
  callingColor: text("calling_color").notNull().default("#3b82f6"), // "CALLING" text color
  highlightBoxColor: text("highlight_box_color").notNull().default("#ef4444"), // "HIGHLIGHT BOX" color
  historyNameColor: text("history_name_color").notNull().default("#6b7280"), // "HISTORY NAME" color
  clinicNameColor: text("clinic_name_color").notNull().default("#1f2937"), // "NAMA KLINIK" color
  // Modal styling (for highlight display)
  modalBackgroundColor: text("modal_background_color").notNull().default("#1e293b"), // Modal background
  modalBorderColor: text("modal_border_color").notNull().default("#fbbf24"), // Modal border lines
  modalTextColor: text("modal_text_color").notNull().default("#ffffff"), // Modal text color
  // Gradient support
  callingGradient: text("calling_gradient"), // Optional gradient for CALLING
  highlightBoxGradient: text("highlight_box_gradient"), // Optional gradient for HIGHLIGHT BOX
  historyNameGradient: text("history_name_gradient"), // Optional gradient for HISTORY NAME
  clinicNameGradient: text("clinic_name_gradient"), // Optional gradient for NAMA KLINIK
  // Background and accent colors
  backgroundColor: text("background_color").notNull().default("#ffffff"),
  backgroundGradient: text("background_gradient"), // Optional gradient for background
  accentColor: text("accent_color").notNull().default("#f3f4f6"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  // Account isolation
  userId: varchar("user_id").notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export const insertWindowSchema = createInsertSchema(windows).pick({
  name: true,
  userId: true,
});

export const insertPatientSchema = createInsertSchema(patients).pick({
  name: true,
  number: true,
  isPriority: true,
  priorityReason: true,
  userId: true,
}).extend({
  name: z.string().nullable().refine(
    (val) => !val || val.length <= 25,
    { message: "Nama pesakit tidak boleh melebihi 25 karakter" }
  )
});

export const insertSettingSchema = createInsertSchema(settings).pick({
  key: true,
  value: true,
  category: true,
  userId: true,
});

export const insertMediaSchema = createInsertSchema(media).pick({
  name: true,
  filename: true,
  url: true,
  data: true,
  type: true,
  mimeType: true,
  size: true,
  userId: true,
});

export const insertTextGroupSchema = createInsertSchema(textGroups).pick({
  groupName: true,
  displayName: true,
  description: true,
  color: true,
  backgroundColor: true,
  fontSize: true,
  fontWeight: true,
  textAlign: true,
  gradient: true,
  userId: true,
});

export const insertThemeSchema = createInsertSchema(themes).pick({
  name: true,
  primaryColor: true,
  secondaryColor: true,
  callingColor: true,
  highlightBoxColor: true,
  historyNameColor: true,
  clinicNameColor: true,
  modalBackgroundColor: true,
  modalBorderColor: true,
  modalTextColor: true,
  callingGradient: true,
  highlightBoxGradient: true,
  historyNameGradient: true,
  clinicNameGradient: true,
  backgroundColor: true,
  backgroundGradient: true,
  accentColor: true,
  userId: true,
});

export const insertQrSessionSchema = createInsertSchema(qrSessions).omit({
  id: true,
  createdAt: true,
});


// Sound mode enum for type safety - only preset mode supported
export const SoundMode = z.enum(["preset"]);
export type SoundModeType = z.infer<typeof SoundMode>;

// Preset sound keys - 13 uploaded audio files (5 original + 8 new)
export const PresetSoundKey = z.enum([
  "notification_sound",
  "subway_chime", 
  "header_tone",
  "airport_chime", 
  "airport_call",
  // New audio files added
  "airport_ding_1569",
  "melodic_airport_ding_1570",
  "flute_phone_alert_2316",
  "happy_bells_937",
  "orchestra_trumpets_triumphant_2285",
  "orchestra_trumpets_ending_2292",
  "software_remove_2576",
  "trumpet_fanfare_2293"
]);
export type PresetSoundKeyType = z.infer<typeof PresetSoundKey>;

// Audio settings schema - simplified preset-only system
export const AudioSettingsSchema = z.object({
  enableSound: z.boolean().default(true),
  volume: z.number().min(0).max(100).default(70),
  soundMode: SoundMode.default("preset"),
  presetKey: PresetSoundKey.default("airport_call"),
});

export type AudioSettings = z.infer<typeof AudioSettingsSchema>;

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWindow = z.infer<typeof insertWindowSchema>;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type InsertTextGroup = z.infer<typeof insertTextGroupSchema>;
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type InsertQrSession = z.infer<typeof insertQrSessionSchema>;

// Select types
export type User = typeof users.$inferSelect;
export type Window = typeof windows.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Media = typeof media.$inferSelect;
export type TextGroup = typeof textGroups.$inferSelect;
export type Theme = typeof themes.$inferSelect;
export type QrSession = typeof qrSessions.$inferSelect;

// Lightweight DTO for TV Display (reduces payload from ~70KB to ~10KB)
// Excludes: trackingHistory, metadata, most timestamps, dispensary flags
// Includes: Essential display fields + isPriority for visual indicators
export type TvQueueItem = {
  id: string;
  name: string | null;
  number: number;
  status: "waiting" | "called" | "in-progress" | "completed" | "requeue" | "dispensary";
  isPriority: boolean; // ✅ Keep for priority badge display
  windowId: string | null; // ✅ Keep for dispensary logic and reconciliation
  windowName: string | null; // Joined from windows table
  calledAt: string | null; // ✅ ISO string format for JSON efficiency
  requeueReason: string | null;
};
