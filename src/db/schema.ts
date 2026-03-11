import { sql, relations } from 'drizzle-orm';
import {
  text,
  integer,
  real,
  sqliteTable,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';

// ─── Auth.js tables ───────────────────────────────────────────────────────────

export const users = sqliteTable('user', {
  id: text('id').notNull().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const accounts = sqliteTable(
  'account',
  {
    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─── Domain tables ─────────────────────────────────────────────────────────────

export const cities = sqliteTable('city', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  state: text('state').notNull(),        // "SP", "MG", etc.
  ibgeCode: text('ibge_code').notNull().unique(),
  population: integer('population'),
}, (t) => ({
  stateIdx: index('city_state_idx').on(t.state),
}));

export const categories = sqliteTable('category', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull().unique(),
});

export const commerces = sqliteTable('commerce', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address'),
  cityId: text('city_id').references(() => cities.id),
  lat: real('lat'),
  lng: real('lng'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  instagram: text('instagram'),
  logoUrl: text('logo_url'),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  ownerIdx: index('commerce_owner_idx').on(t.ownerId),
  cityIdx: index('commerce_city_idx').on(t.cityId),
  publishedIdx: index('commerce_published_idx').on(t.published),
}));

export const commerceCategories = sqliteTable(
  'commerce_category',
  {
    commerceId: text('commerce_id').notNull().references(() => commerces.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.commerceId, t.categoryId] }),
  })
);

export const commerceModalities = sqliteTable(
  'commerce_modality',
  {
    commerceId: text('commerce_id').notNull().references(() => commerces.id, { onDelete: 'cascade' }),
    modality: text('modality', { enum: ['delivery', 'dine_in', 'takeout'] }).notNull(),
    deliveryRadiusKm: real('delivery_radius_km'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.commerceId, t.modality] }),
  })
);

export const operatingHours = sqliteTable('operating_hours', {
  id: text('id').notNull().primaryKey(),
  commerceId: text('commerce_id').notNull().references(() => commerces.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0=dom .. 6=sab
  opensAt: text('opens_at').notNull(),   // "HH:MM"
  closesAt: text('closes_at').notNull(), // "HH:MM"
}, (t) => ({
  commerceIdx: index('hours_commerce_idx').on(t.commerceId),
}));

export const menus = sqliteTable('menu', {
  id: text('id').notNull().primaryKey(),
  commerceId: text('commerce_id').notNull().unique().references(() => commerces.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type City = typeof cities.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Commerce = typeof commerces.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type OperatingHours = typeof operatingHours.$inferSelect;

// ─── Relations ─────────────────────────────────────────────────────────────────

export const commercesRelations = relations(commerces, ({ one, many }) => ({
  owner: one(users, { fields: [commerces.ownerId], references: [users.id] }),
  city: one(cities, { fields: [commerces.cityId], references: [cities.id] }),
  commerceCategories: many(commerceCategories),
  commerceModalities: many(commerceModalities),
  operatingHours: many(operatingHours),
  menu: one(menus, { fields: [commerces.id], references: [menus.commerceId] }),
}));

export const commerceCategoriesRelations = relations(commerceCategories, ({ one }) => ({
  commerce: one(commerces, { fields: [commerceCategories.commerceId], references: [commerces.id] }),
  category: one(categories, { fields: [commerceCategories.categoryId], references: [categories.id] }),
}));

export const commerceModalitiesRelations = relations(commerceModalities, ({ one }) => ({
  commerce: one(commerces, { fields: [commerceModalities.commerceId], references: [commerces.id] }),
}));

export const operatingHoursRelations = relations(operatingHours, ({ one }) => ({
  commerce: one(commerces, { fields: [operatingHours.commerceId], references: [commerces.id] }),
}));

export const menusRelations = relations(menus, ({ one }) => ({
  commerce: one(commerces, { fields: [menus.commerceId], references: [commerces.id] }),
}));

export const citiesRelations = relations(cities, ({ many }) => ({
  commerces: many(commerces),
}));
