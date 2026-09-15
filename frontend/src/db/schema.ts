// frontend/src/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  varchar,
  index,
  uniqueIndex,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users ─────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    passwordHash: text("password_hash"),
    avatarUrl: text("avatar_url"),
    plan: varchar("plan", { length: 50 }).default("free"),
    isPremium: boolean("is_premium").default(false),
    subscriptionId: text("subscription_id"),
    subscriptionExpiry: timestamp("subscription_expiry"),
    credits: integer("credits").default(50),
    birthMonth: integer("birth_month"),
    birthYear: integer("birth_year"),
    oauthProvider: varchar("oauth_provider", { length: 50 }),
    oauthId: text("oauth_id"),
    googleId: text("google_id"),
    githubId: text("github_id"),
    microsoftId: text("microsoft_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    oauthProviderIdx: index("users_oauth_provider_idx").on(table.oauthProvider),
  })
);

// ─── Conversations ──────────────────────────────────────
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull().default("New Chat"),
    model: varchar("model", { length: 100 }).default("auto"),
    focusMode: varchar("focus_mode", { length: 50 }).default("all"),
    webSearchEnabled: boolean("web_search_enabled").default(true),
    workspace: varchar("workspace", { length: 50 }).default("personal"),
    pinned: boolean("pinned").default(false),
    archived: boolean("archived").default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("conversations_user_id_idx").on(table.userId),
    userUpdatedIdx: index("conversations_user_updated_idx").on(
      table.userId,
      table.updatedAt
    ),
    deletedAtIdx: index("conversations_deleted_at_idx").on(table.deletedAt),
  })
);

// ─── Messages ──────────────────────────────────────────
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // ✅ ADDED direct user_id for faster filtering & isolation
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    model: varchar("model", { length: 100 }),
    sources: jsonb("sources"),
    citations: jsonb("citations"),
    toolCalls: jsonb("tool_calls"),
    feedback: varchar("feedback", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    convIdIdx: index("messages_conversation_id_idx").on(table.conversationId),
    userIdIdx: index("messages_user_id_idx").on(table.userId),
    // Composite index for filtering by user + conversation
    userConvIdx: index("messages_user_conv_idx").on(
      table.userId,
      table.conversationId
    ),
    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
  })
);

// ─── Files (Uploads) ────────────────────────────────────
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 500 }).notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    size: integer("size").notNull(),
    url: text("url"),
    status: varchar("status", { length: 50 }).default("uploading"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("files_user_id_idx").on(table.userId),
    convIdIdx: index("files_conversation_id_idx").on(table.conversationId),
    statusIdx: index("files_status_idx").on(table.status),
  })
);

// ─── User Settings (one‑to‑one with users) ──────────────
export const userSettings = pgTable(
  "user_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    theme: varchar("theme", { length: 20 }).default("system"),
    fontSize: varchar("font_size", { length: 10 }).default("md"),
    sidebarCollapsed: boolean("sidebar_collapsed").default(false),
    defaultModel: varchar("default_model", { length: 100 }).default("auto"),
    defaultFocusMode: varchar("default_focus_mode", { length: 50 }).default(
      "all"
    ),
    webSearchDefault: boolean("web_search_default").default(true),
    shortcuts: jsonb("shortcuts"),
    voiceEnabled: boolean("voice_enabled").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("user_settings_user_id_idx").on(table.userId),
  })
);

// ─── Drizzle Relations (for type‑safe joins) ────────────
export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations),
  messages: many(messages),
  files: many(files),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
    files: many(files),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [files.conversationId],
    references: [conversations.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));