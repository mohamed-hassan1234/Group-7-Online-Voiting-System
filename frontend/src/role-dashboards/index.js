const roleDashboardFiles = import.meta.glob("./*.dashboard.js", { eager: true });

const roleDashboardMap = {};

// Auto-register every file in /role-dashboards that exports { role, ... }.
Object.values(roleDashboardFiles).forEach((moduleItem) => {
  const config = moduleItem.default;
  if (config?.role) {
    roleDashboardMap[config.role] = config;
  }
});

const createFallbackDashboard = (role) => ({
  role,
  title: `${role.charAt(0).toUpperCase()}${role.slice(1)} Dashboard`,
  subtitle: "This role is active. Add a custom file in /src/role-dashboards for a unique UI.",
  highlights: [
    "Route is ready automatically for this role.",
    "Schema and controller already validate this role from backend constants.",
    "You can customize this role dashboard without touching routing logic.",
  ],
});

export const getRoleDashboardConfig = (role) =>
  roleDashboardMap[role] || createFallbackDashboard(role);

export const getRegisteredDashboardRoles = () => Object.keys(roleDashboardMap);
