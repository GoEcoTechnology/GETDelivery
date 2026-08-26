export type Permission = 
  | 'inventory.view'
  | 'inventory.create'
  | 'inventory.update'
  | 'inventory.stock_in'
  | 'inventory.stock_out'
  | 'delivery.view'
  | 'delivery.create'
  | 'delivery.update'
  | 'delivery.dispatch'
  | 'delivery.assign'
  | 'delivery.cancel'
  | 'delivery.manage'
  | 'employee.view'
  | 'employee.create'
  | 'employee.update'
  | 'employee.delete'
  | 'reports.view'
  | 'platform.manage_tenants'
  | 'platform.manage_partners'
  | 'partner.access';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  PLATFORM_OWNER: [
    // Platform owners bypass normal permission checks for tenant-level stuff, 
    // but we can list all permissions here just to be explicit if they act on a tenant.
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.stock_in', 'inventory.stock_out',
    'delivery.view', 'delivery.create', 'delivery.update', 'delivery.dispatch', 'delivery.assign', 'delivery.cancel', 'delivery.manage',
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'reports.view',
    'platform.manage_tenants',
    'platform.manage_partners'
  ],
  BUSINESS_OWNER: [
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.stock_in', 'inventory.stock_out',
    'delivery.view', 'delivery.create', 'delivery.update', 'delivery.dispatch', 'delivery.assign', 'delivery.cancel', 'delivery.manage',
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'reports.view'
  ],
  EMPLOYEE: [
    'inventory.view',
    'delivery.view',
    'delivery.create', // Employees can create deliveries
    'reports.view'
    // By default, generic employees do NOT have stock_in/stock_out or dispatch abilities
    // unless explicitly granted. For this phase, we hardcode the baseline.
  ],
  DELIVERY_PARTNER: [
    'partner.access'
  ]
};

export function hasPermission(role: string | null | undefined, requiredPermission: Permission): boolean {
  if (!role) return false;
  if (role === 'PLATFORM_OWNER') return true; // Super admin
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(requiredPermission);
}
