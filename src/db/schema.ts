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
  contactPerson: varchar("contact_person", { length: 255 }),
  status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }), // Nullable for Platform Owners
  name: varchar("name", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  contactNumber: varchar("contact_number", { length: 50 }),
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

export const stockIns = pgTable('stock_ins', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitCost: varchar('unit_cost', { length: 50 }),
  supplier: varchar('supplier', { length: 255 }),
  notes: text('notes'),
  referenceNumber: varchar('reference_number', { length: 100 }),
  performedBy: integer('performed_by').references(() => users.id),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('stockins_tenant_idx').on(table.tenantId),
  index('stockins_reference_idx').on(table.referenceNumber),
  index('stockins_created_idx').on(table.createdAt),
]);

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  customerCode: varchar("customer_code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  mobileNumber: varchar("mobile_number", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  address: text("address").notNull(),
  municipality: varchar("municipality", { length: 100 }),
  barangay: varchar("barangay", { length: 100 }),
  status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("customers_tenant_idx").on(table.tenantId),
]);

export const stockOuts = pgTable('stock_outs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }).notNull(),
  reason: varchar('reason', { length: 255 }).notNull(),
  notes: text('notes'),
  performedBy: integer('performed_by').references(() => users.id),
  status: varchar('status', { length: 50 }).default('COMPLETED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('stockouts_tenant_idx').on(table.tenantId),
  index('stockouts_reference_idx').on(table.referenceNumber),
  index('stockouts_created_idx').on(table.createdAt),
]);

export const deliveryBatches = pgTable('delivery_batches', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 50 }).default('ACTIVE').notNull(),
  maxOrders: integer('max_orders').default(10).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('batches_tenant_idx').on(table.tenantId),
  index('batches_status_idx').on(table.status),
]);

export const deliveryOrders = pgTable('delivery_orders', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  batchId: integer('batch_id').references(() => deliveryBatches.id, { onDelete: 'set null' }),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerContact: varchar('customer_contact', { length: 100 }),
  pickupAddress: text('pickup_address').notNull(),
  dropoffAddress: text('dropoff_address').notNull(),
  pickupLat: decimal('pickup_lat', { precision: 10, scale: 7 }),
  pickupLng: decimal('pickup_lng', { precision: 10, scale: 7 }),
  dropoffLat: decimal('dropoff_lat', { precision: 10, scale: 7 }),
  dropoffLng: decimal('dropoff_lng', { precision: 10, scale: 7 }),
  routeDistance: varchar('route_distance', { length: 50 }),
  routeDuration: varchar('route_duration', { length: 50 }),
  routePolyline: text('route_polyline'),
  deliveryDate: timestamp('delivery_date'),
  deliveryTime: varchar('delivery_time', { length: 50 }),
  instructions: text('instructions'),
    offeredAmount: decimal('offered_amount', { precision: 10, scale: 2 }),
    requiredVehicleType: varchar('required_vehicle_type', { length: 100 }),
    vehicleBasePrice: decimal('vehicle_base_price', { precision: 10, scale: 2 }),
    pricePerKm: decimal('price_per_km', { precision: 10, scale: 2 }),
    distanceKm: decimal('distance_km', { precision: 10, scale: 2 }),
    finalDeliveryPrice: decimal('final_delivery_price', { precision: 10, scale: 2 }),
    pricingFrozenAt: timestamp('pricing_frozen_at'),
    temporaryWinnerId: integer('temporary_winner_id').references(() => deliveryPartners.id),
  approvedAt: timestamp('approved_at'),
  preferredVehicle: varchar('preferred_vehicle', { length: 100 }),
  status: varchar('status', { length: 50 }).default('DRAFT').notNull(),
  quota: integer('quota').default(10).notNull(),
  currentOrdersCount: integer('current_orders_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('orders_tenant_idx').on(table.tenantId),
  index('orders_customer_idx').on(table.customerId),
  index('orders_status_idx').on(table.status),
  index('orders_tenant_status_idx').on(table.tenantId, table.status),
  index('orders_tenant_created_idx').on(table.tenantId, table.createdAt),
  index('orders_batch_idx').on(table.batchId),
  ]);

export const platformDeliverySettings = pgTable('platform_delivery_settings', {
  id: serial('id').primaryKey(),
  pricePerKm: decimal('price_per_km', { precision: 10, scale: 2 }).default('0').notNull(),
  currencyCode: varchar('currency_code', { length: 10 }).default('PHP').notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vehicleDeliveryRates = pgTable('vehicle_delivery_rates', {
  id: serial('id').primaryKey(),
  vehicleType: varchar('vehicle_type', { length: 100 }).notNull().unique(),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).default('0').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('vehicle_delivery_rates_vehicle_type_idx').on(table.vehicleType),
]);

export const deliveryItems = pgTable('delivery_items', {
  id: serial('id').primaryKey(),
  deliveryOrderId: integer('delivery_order_id').references(() => deliveryOrders.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unit: varchar('unit', { length: 50 }),
}, (table) => [
  index('items_order_idx').on(table.deliveryOrderId),
]);

export const deliveryInvitations = pgTable('delivery_invitations', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  deliveryOrderId: integer('delivery_order_id').references(() => deliveryOrders.id, { onDelete: 'cascade' }).notNull(),
  deliveryPartnerId: integer('delivery_partner_id').references(() => deliveryPartners.id).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(),
  declineReason: varchar('decline_reason', { length: 255 }),
  sentAt: timestamp('sent_at').defaultNow(),
  openedAt: timestamp('opened_at'),
  respondedAt: timestamp('responded_at'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('invitations_tenant_idx').on(table.tenantId),
  index('invitations_order_idx').on(table.deliveryOrderId),
  index('invitations_token_idx').on(table.tokenHash),
]);

export const deliveryAssignments = pgTable('delivery_assignments', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  deliveryOrderId: integer('delivery_order_id').references(() => deliveryOrders.id, { onDelete: 'cascade' }).notNull(),
  deliveryPartnerId: integer('delivery_partner_id').references(() => deliveryPartners.id),
  driverName: varchar('driver_name', { length: 255 }).notNull(),
  vehicleDetails: varchar('vehicle_details', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('ASSIGNED').notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (table) => [
  index('assignments_tenant_idx').on(table.tenantId),
  index('assignments_order_idx').on(table.deliveryOrderId),
]);

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  actorId: integer('actor_id'),
  actorType: varchar('actor_type', { length: 50 }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }),
  entityId: integer('entity_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('audit_tenant_idx').on(table.tenantId),
  index('audit_tenant_created_idx').on(table.tenantId, table.createdAt),
]);

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  deliveryOrderId: integer('delivery_order_id').references(() => deliveryOrders.id, { onDelete: 'cascade' }),
  senderId: integer('sender_id'),
  receiverId: integer('receiver_id').notNull(),
  receiverRole: varchar('receiver_role', { length: 50 }).notNull(),
  recipientEmail: varchar('recipient_email', { length: 255 }),
  notificationType: varchar('notification_type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  image: varchar('image', { length: 255 }),
  actionUrl: varchar('action_url', { length: 255 }),
  status: varchar('status', { length: 50 }).default('UNREAD').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  readAt: timestamp('read_at'),
  clickedAt: timestamp('clicked_at'),
  sentAt: timestamp('sent_at'),
  failedAt: timestamp('failed_at'),
}, (table) => [
  index('notif_receiver_idx').on(table.receiverId),
  index('notif_tenant_idx_2').on(table.tenantId),
  index('notif_created_idx').on(table.createdAt),
  index('notif_status_idx_2').on(table.status),
]);

export const productQuotas = pgTable('product_quotas', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  targetQuantity: integer('target_quantity').default(20).notNull(),
  accumulatedQuantity: integer('accumulated_quantity').default(0).notNull(),
  status: varchar('status', { length: 50 }).default('IN_PROGRESS').notNull(),
}, (table) => [
  index('product_quotas_tenant_idx').on(table.tenantId),
  index('product_quotas_product_idx').on(table.productId),
]);

export const quotaAccumulations = pgTable('quota_accumulations', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  sourceOrderId: integer('source_order_id').references(() => deliveryOrders.id, { onDelete: 'cascade' }).notNull(),
  sourceItemId: integer('source_item_id').references(() => deliveryItems.id, { onDelete: 'cascade' }).notNull(),
  quantityAdded: integer('quantity_added').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('quota_accum_tenant_idx').on(table.tenantId),
  index('quota_accum_product_idx').on(table.productId),
  index('quota_accum_order_idx').on(table.sourceOrderId),
  index('quota_accum_item_idx').on(table.sourceItemId),
]);
