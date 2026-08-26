import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  decimal,
  text,
  index,
  boolean,
} from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subscriptionPlan: varchar("subscription_plan", { length: 50 }).default("FREE").notNull(),
  status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }), // Nullable for Platform Owners
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(), // PLATFORM_OWNER, BUSINESS_OWNER, EMPLOYEE
  status: varchar("status", { length: 50 }).default("PENDING").notNull(), // PENDING, ACTIVE, REJECTED
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("users_tenant_idx").on(table.tenantId),
  index("users_email_idx").on(table.email),
  index("users_tenant_status_idx").on(table.tenantId, table.status),
]);

export const deliveryPartners = pgTable("delivery_partners", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }).notNull(),
  mobileNumber: varchar("mobile_number", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }), // Added for Partner Portal Login
  status: varchar("status", { length: 50 }).default("PENDING").notNull(), // ACTIVE, PENDING, REJECTED, AVAILABLE
  notificationToken: varchar("notification_token", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("partners_mobile_idx").on(table.mobileNumber),
  index("partners_status_idx").on(table.status),
]);

export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  deliveryPartnerId: integer("delivery_partner_id").references(() => deliveryPartners.id),
  name: varchar("name", { length: 255 }).notNull(),
  mobile: varchar("mobile", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
  licenseNumber: varchar("license_number", { length: 100 }),
  licenseType: varchar("license_type", { length: 50 }),
  licenseRestrictions: varchar("license_restrictions", { length: 255 }),
  licenseExpiry: timestamp("license_expiry"),
  licenseStatus: varchar("license_status", { length: 50 }).default("VALID"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("drivers_tenant_idx").on(table.tenantId),
  index("drivers_license_expiry_idx").on(table.licenseExpiry),
]);

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  deliveryPartnerId: integer("delivery_partner_id").references(() => deliveryPartners.id),
  plateNumber: varchar("plate_number", { length: 50 }).notNull(),
  vehicleType: varchar("vehicle_type", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
  registrationExpiry: timestamp("registration_expiry"),
  registrationStatus: varchar("registration_status", { length: 50 }).default("ACTIVE"),
  orNumber: varchar("or_number", { length: 100 }),
  crNumber: varchar("cr_number", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("vehicles_tenant_idx").on(table.tenantId),
  index("vehicles_reg_expiry_idx").on(table.registrationExpiry),
  index("vehicles_plate_idx").on(table.plateNumber),
]);

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }),
  barcode: varchar("barcode", { length: 100 }),
  category: varchar("category", { length: 100 }),
  unit: varchar("unit", { length: 50 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  stock: integer("stock").default(0).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(0),
  productType: varchar("product_type", { length: 50 }),
  status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("products_tenant_idx").on(table.tenantId),
  index("products_sku_idx").on(table.sku),
  index("products_tenant_status_idx").on(table.tenantId, table.status),
  index("products_tenant_category_idx").on(table.tenantId, table.category),
]);

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(), // IN, OUT
  reference: varchar("reference", { length: 255 }),
  performedBy: integer("performed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("inv_trans_tenant_idx").on(table.tenantId),
  index("inv_trans_product_idx").on(table.productId),
  index("inv_trans_tenant_created_idx").on(table.tenantId, table.createdAt),
]);

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  customerCode: varchar("customer_code", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  mobileNumber: varchar("mobile_number", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  address: text("address").notNull(),
  municipality: varchar("municipality", { length: 100 }),
  barangay: varchar("barangay", { length: 100 }),
  notes: text("notes"),
  status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("customers_tenant_idx").on(table.tenantId),
  index("customers_code_idx").on(table.customerCode),
]);



export const deliveryOrders = pgTable("delivery_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  customerId: integer("customer_id").references(() => customers.id),

  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerContact: varchar("customer_contact", { length: 100 }),
  pickupAddress: text("pickup_address").notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  deliveryDate: timestamp("delivery_date"),
  deliveryTime: varchar("delivery_time", { length: 50 }),
  instructions: text("instructions"),
  offeredAmount: decimal("offered_amount", { precision: 10, scale: 2 }),
  temporaryWinnerId: integer("temporary_winner_id").references(() => deliveryPartners.id),
  approvedAt: timestamp("approved_at"),
  status: varchar("status", { length: 50 }).default("DRAFT").notNull(), // DRAFT, CONFIRMED, READY_FOR_DISPATCH, DISPATCHED, WAITING_APPROVAL, COMPLETED, CANCELLED
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("orders_tenant_idx").on(table.tenantId),
  index("orders_status_idx").on(table.status),
  index("orders_tenant_status_idx").on(table.tenantId, table.status),
  index("orders_tenant_created_idx").on(table.tenantId, table.createdAt),
]);

export const deliveryItems = pgTable("delivery_items", {
  id: serial("id").primaryKey(),
  deliveryOrderId: integer("delivery_order_id").references(() => deliveryOrders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unit: varchar("unit", { length: 50 }),
}, (table) => [
  index("items_order_idx").on(table.deliveryOrderId),
]);

export const deliveryInvitations = pgTable("delivery_invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  deliveryOrderId: integer("delivery_order_id").references(() => deliveryOrders.id).notNull(),
  deliveryPartnerId: integer("delivery_partner_id").references(() => deliveryPartners.id).notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("PENDING").notNull(), // PENDING, OPENED, ASSIGNED, DECLINED, EXPIRED, CANCELLED, TEMPORARY_WINNER
  declineReason: varchar("decline_reason", { length: 255 }),
  sentAt: timestamp("sent_at").defaultNow(),
  openedAt: timestamp("opened_at"),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("invitations_tenant_idx").on(table.tenantId),
  index("invitations_order_idx").on(table.deliveryOrderId),
  index("invitations_token_idx").on(table.tokenHash),
]);

export const deliveryAssignments = pgTable("delivery_assignments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  deliveryOrderId: integer("delivery_order_id").references(() => deliveryOrders.id).notNull(),
  deliveryPartnerId: integer("delivery_partner_id").references(() => deliveryPartners.id),
  driverName: varchar("driver_name", { length: 255 }).notNull(),
  vehicleDetails: varchar("vehicle_details", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("ASSIGNED").notNull(), // ASSIGNED, ARRIVING_AT_PICKUP, ARRIVED_AT_PICKUP, PICKED_UP, IN_TRANSIT, ARRIVED_AT_DESTINATION, DELIVERED
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
}, (table) => [
  index("assignments_tenant_idx").on(table.tenantId),
  index("assignments_order_idx").on(table.deliveryOrderId),
]);

export const notificationQueue = pgTable("notification_queue", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),
  deliveryOrderId: integer("delivery_order_id").references(() => deliveryOrders.id),
  recipientType: varchar("recipient_type", { length: 50 }).notNull(),
  recipientId: integer("recipient_id").notNull(),
  channel: varchar("channel", { length: 50 }).notNull(), // FCM
  status: varchar("status", { length: 50 }).default("PENDING").notNull(),
  attemptCount: integer("attempt_count").default(0).notNull(),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  failedAt: timestamp("failed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("notif_status_idx").on(table.status),
  index("notif_tenant_idx").on(table.tenantId),
]);

export const smsQueue = pgTable("sms_queue", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),
  deliveryOrderId: integer("delivery_order_id").references(() => deliveryOrders.id),
  recipientMobile: varchar("recipient_mobile", { length: 50 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 50 }).default("PENDING").notNull(),
  attemptCount: integer("attempt_count").default(0).notNull(),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  sentAt: timestamp("sent_at"),
  failedAt: timestamp("failed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sms_status_idx").on(table.status),
  index("sms_tenant_idx").on(table.tenantId),
]);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),
  actorId: integer("actor_id"),
  actorType: varchar("actor_type", { length: 50 }), // USER, PARTNER, SYSTEM
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }),
  entityId: integer("entity_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("audit_tenant_idx").on(table.tenantId),
  index("audit_tenant_created_idx").on(table.tenantId, table.createdAt),
]);

export const partnerNotifications = pgTable("partner_notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  deliveryPartnerId: integer("delivery_partner_id").references(() => deliveryPartners.id).notNull(),
  deliveryOrderId: integer("delivery_order_id").references(() => deliveryOrders.id),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("partner_notif_partner_idx").on(table.deliveryPartnerId),
  index("partner_notif_unread_idx").on(table.deliveryPartnerId, table.isRead),
]);

export const tenantNotifications = pgTable("tenant_notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  deliveryOrderId: integer("delivery_order_id").references(() => deliveryOrders.id),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("tenant_notif_tenant_idx").on(table.tenantId),
]);
