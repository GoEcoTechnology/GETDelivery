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
  | 'delivery.delete'
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
    'delivery.view', 'delivery.create', 'delivery.update', 'delivery.dispatch', 'delivery.assign', 'delivery.cancel', 'delivery.manage', 'delivery.delete',
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'reports.view',
    'platform.manage_tenants',
    'platform.manage_partners'
  ],
  BUSINESS_OWNER: [
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.stock_in', 'inventory.stock_out',
    'delivery.view', 'delivery.create', 'delivery.update', 'delivery.dispatch', 'delivery.assign', 'delivery.cancel', 'delivery.manage', 'delivery.delete',
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'reports.view'
  ],
  EMPLOYEE: [
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.stock_in', 'inventory.stock_out',
    'delivery.view', 'delivery.create', 'delivery.update', 'delivery.dispatch', 'delivery.assign', 'delivery.cancel', 'delivery.manage', 'delivery.delete',
    'employee.view', 'employee.create', 'employee.update', 'employee.delete'
    // Employees have all business owner permissions EXCEPT reports.view
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
