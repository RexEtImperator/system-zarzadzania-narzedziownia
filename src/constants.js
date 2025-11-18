export const PERMISSIONS = {
  // Users management
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  CREATE_USERS: 'create_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  // System administration
  VIEW_ADMIN: 'view_admin',
  SYSTEM_SETTINGS: 'system_settings',
  MANAGE_DEPARTMENTS: 'manage_departments',
  MANAGE_POSITIONS: 'manage_positions',
  // Manage roles
  MANAGE_ROLES: 'manage_roles',
  VIEW_ROLES: 'view_roles',
  // Delete issue, return, and service history
  DELETE_ISSUE_HISTORY: 'delete_issue_history',
  DELETE_RETURN_HISTORY: 'delete_return_history',
  DELETE_SERVICE_HISTORY: 'delete_service_history',
  // Database
  VIEW_DATABASE: 'view_database',
  MANAGE_DATABASE: 'manage_database',
  // Audit logs
  VIEW_AUDIT_LOG: 'view_audit_log',
  // Analytics
  VIEW_ANALYTICS: 'view_analytics',
  // Tools management
  VIEW_TOOLS: 'view_tools',
  MANAGE_TOOLS: 'manage_tools',
  // Tools history visibility
  VIEW_TOOL_HISTORY: 'view_tool_history',
  // Labels
  VIEW_LABELS: 'view_labels',
  // Employees
  VIEW_EMPLOYEES: 'view_employees',
  MANAGE_EMPLOYEES: 'manage_employees',
  // BHP
  VIEW_BHP: 'view_bhp',
  MANAGE_BHP: 'manage_bhp',
  // BHP history visibility
  VIEW_BHP_HISTORY: 'view_bhp_history',
  // Dashboard / Quick actions
  VIEW_QUICK_ACTIONS: 'view_quick_actions',
  // Inventory check
  VIEW_INVENTORY: 'view_inventory',
  INVENTORY_MANAGE_SESSIONS: 'inventory_manage_sessions',
  INVENTORY_SCAN: 'inventory_scan',
  INVENTORY_ACCEPT_CORRECTION: 'inventory_accept_correction',
  INVENTORY_DELETE_CORRECTION: 'inventory_delete_correction',
  INVENTORY_EXPORT_CSV: 'inventory_export_csv',
  // Auxiliary (for readability of calls)
  ADMIN: 'admin'
};

// User roles
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  HR: 'hr',
  USER: 'user',
  EMPLOYEE: 'employee',
};

// User statuses
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended'
};

// Department status
export const DEPARTMENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

// Audit actions
export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  VIEW: 'view'
};

// Pagination config
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [5, 10, 20, 50, 100]
};

// Config API
export const API_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3
};

// Endpoints API
export const API_ENDPOINTS = {
  // auth
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  REFRESH_TOKEN: '/api/auth/refresh',
  
  // Users
  USERS: '/api/users',
  USER_BY_ID: (id) => `/api/users/${id}`,
  
  // Departments
  DEPARTMENTS: '/api/departments',
  DEPARTMENT_BY_ID: (id) => `/api/departments/${id}`,
  
  // Positions
  POSITIONS: '/api/positions',
  POSITION_BY_ID: (id) => `/api/positions/${id}`,
  
  // Roles
  ROLES: '/api/roles',
  ROLE_BY_ID: (id) => `/api/roles/${id}`,
  
  // Audit
  AUDIT_LOG: '/api/audit',
  
  // Analytics
  ANALYTICS: '/api/analytics',
  
  // Application configuration
  CONFIG: '/api/config'
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Błąd połączenia z serwerem',
  UNAUTHORIZED: 'Brak uprawnień do wykonania tej operacji',
  FORBIDDEN: 'Dostęp zabroniony',
  NOT_FOUND: 'Nie znaleziono zasobu',
  VALIDATION_ERROR: 'Błąd walidacji danych',
  SERVER_ERROR: 'Błąd serwera',
  UNKNOWN_ERROR: 'Wystąpił nieznany błąd'
};

// Success messages
export const SUCCESS_MESSAGES = {
  USER_CREATED: 'Użytkownik został utworzony pomyślnie',
  USER_UPDATED: 'Dane użytkownika zostały zaktualizowane',
  USER_DELETED: 'Użytkownik został usunięty',
  DEPARTMENT_CREATED: 'Departament został utworzony pomyślnie',
  DEPARTMENT_UPDATED: 'Departament został zaktualizowany',
  DEPARTMENT_DELETED: 'Departament został usunięty',
  POSITION_CREATED: 'Stanowisko zostało utworzone pomyślnie',
  POSITION_UPDATED: 'Stanowisko zostało zaktualizowane',
  POSITION_DELETED: 'Stanowisko zostało usunięte',
  SETTINGS_SAVED: 'Ustawienia zostały zapisane'
};

// Theme colors
export const THEME_COLORS = {
  PRIMARY: '#3b82f6',
  SECONDARY: '#64748b',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#06b6d4'
};

// Function to check user permissions
// Dynamic permissions loaded from the backend
let dynamicRolePermissions = null;
export const setDynamicRolePermissions = (permissionsMap) => {
  try {
    // We expect the object: { administrator: [perm...], manager: [...], employee: [...] }
    dynamicRolePermissions = permissionsMap && typeof permissionsMap === 'object' ? permissionsMap : null;
  } catch (_) {
    dynamicRolePermissions = null;
  }
};

export const hasPermission = (user, permission) => {
  if (!user || !user.role) {
    return false;
  }

  // Normalizacja nazw ról z różnych miejsc aplikacji
  const normalizeRole = (role) => {
    const r = String(role).toLowerCase();
    if (r === 'administrator' || r === 'admin') return ROLES.ADMIN;
    if (r === 'manager') return ROLES.MANAGER;
    if (r === 'hr') return ROLES.HR;
    if (r === 'employee') return ROLES.EMPLOYEE;
    if (r === 'user') return ROLES.USER;
    return r; // fallback: już zgodny z ROLES
  };

  const normalizedRole = normalizeRole(user.role);
  // Admin has all permissions
  if (normalizedRole === ROLES.ADMIN) {
    return true;
  }
  // Mapping roles to permissions (default values ​​– used when there is no data from the backend)
  const rolePermissions = {
    [ROLES.MANAGER]: [
      PERMISSIONS.VIEW_USERS,
      PERMISSIONS.CREATE_USERS,
      PERMISSIONS.EDIT_USERS,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_TOOLS,
      PERMISSIONS.VIEW_TOOL_HISTORY,
      PERMISSIONS.VIEW_LABELS,
      PERMISSIONS.MANAGE_TOOLS,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.MANAGE_EMPLOYEES,
      PERMISSIONS.MANAGE_DEPARTMENTS,
      PERMISSIONS.MANAGE_POSITIONS,
      PERMISSIONS.VIEW_BHP,
      PERMISSIONS.VIEW_BHP_HISTORY,
      PERMISSIONS.MANAGE_BHP,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.INVENTORY_MANAGE_SESSIONS,
      PERMISSIONS.INVENTORY_SCAN,
      PERMISSIONS.INVENTORY_ACCEPT_CORRECTION,
      PERMISSIONS.INVENTORY_DELETE_CORRECTION,
      PERMISSIONS.INVENTORY_EXPORT_CSV
    ],
    [ROLES.HR]: [
      PERMISSIONS.VIEW_USERS,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.MANAGE_EMPLOYEES,
      PERMISSIONS.MANAGE_DEPARTMENTS,
      PERMISSIONS.MANAGE_POSITIONS,
      PERMISSIONS.VIEW_TOOLS,
      PERMISSIONS.VIEW_BHP,
      PERMISSIONS.VIEW_ANALYTICS
    ],
    [ROLES.EMPLOYEE]: [
      PERMISSIONS.VIEW_TOOL_HISTORY,
      PERMISSIONS.VIEW_BHP_HISTORY
    ],
    [ROLES.USER]: []
  };
  // If we have dynamic permissions from the backend, use them first
  if (dynamicRolePermissions) {
    // Map internal role names to API keys
    const apiRoleKey =
      normalizedRole === ROLES.ADMIN ? 'administrator' :
      normalizedRole === ROLES.MANAGER ? 'manager' :
      normalizedRole === ROLES.HR ? 'hr' :
      normalizedRole === ROLES.EMPLOYEE ? 'employee' : normalizedRole;

    const apiRolePerms = dynamicRolePermissions[apiRoleKey] || [];
    return Array.isArray(apiRolePerms) && apiRolePerms.includes(permission);
  }

  // Fallback to static maps if dynamic permissions are missing
  const userPermissions = rolePermissions[normalizedRole] || [];
  return userPermissions.includes(permission);
};