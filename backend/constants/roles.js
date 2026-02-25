// Add new roles here once, and the schema/routes will use them automatically.
export const ROLES = Object.freeze({
  ADMIN: "admin",
  USER: "user",
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));
export const DEFAULT_ROLE = ROLES.USER;

export const normalizeRole = (role) => {
  if (typeof role !== "string") {
    return DEFAULT_ROLE;
  }

  return role.trim().toLowerCase();
};

export const isValidRole = (role) => ROLE_VALUES.includes(role);
