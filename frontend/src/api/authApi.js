import { API_BASE_URL } from "../config/env.js";

const API_HOST = String(API_BASE_URL || "").replace(/\/api\/?$/, "");

const normalizeSingleImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const toApiUploadsPath = (pathname) => {
    const apiMatch = pathname.match(/\/api\/uploads\/(.+)$/i);
    if (apiMatch?.[1]) {
      return `/api/uploads/${apiMatch[1]}`;
    }
    const uploadsMatch = pathname.match(/\/uploads\/(.+)$/i);
    if (uploadsMatch?.[1]) {
      return `/api/uploads/${uploadsMatch[1]}`;
    }
    return "";
  };

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const fixedPath = toApiUploadsPath(parsed.pathname || "");
      if (fixedPath) {
        return `${API_HOST}${fixedPath}`;
      }
      if (parsed.protocol === "http:" && parsed.host === new URL(API_HOST).host) {
        parsed.protocol = "https:";
        return parsed.toString();
      }
      return raw;
    } catch {
      return raw;
    }
  }

  if (raw.startsWith("/")) {
    const fixedPath = toApiUploadsPath(raw);
    if (fixedPath) {
      return `${API_HOST}${fixedPath}`;
    }
    return `${API_HOST}${raw}`;
  }

  return raw;
};

const normalizeImageUrlsDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeImageUrlsDeep(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "imageUrl" && typeof item === "string") {
      result[key] = normalizeSingleImageUrl(item);
    } else {
      result[key] = normalizeImageUrlsDeep(item);
    }
  }
  return result;
};

export const requestJson = async (path, options = {}) => {
  const isFormDataBody = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  });

  let responseData = null;
  try {
    responseData = await response.json();
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    throw new Error(responseData?.message || "Request failed");
  }

  return normalizeImageUrlsDeep(responseData);
};

export const fetchAvailableRoles = () => requestJson("/auth/roles");

export const registerUser = (payload) =>
  requestJson("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const loginUser = (payload) =>
  requestJson("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const logoutAdmin = () =>
  requestJson("/auth/logout", {
    method: "POST",
  });

export const fetchCurrentUser = () => requestJson("/auth/me");

export const updateCurrentUserProfile = (payload) =>
  requestJson("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const changeCurrentUserPassword = (payload) =>
  requestJson("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteCurrentUserAccount = () =>
  requestJson("/auth/me", {
    method: "DELETE",
  });

export const registerVoter = (payload) =>
  requestJson("/voter/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const loginVoter = (payload) =>
  requestJson("/voter/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const logoutVoter = () =>
  requestJson("/voter/logout", {
    method: "POST",
  });

export const fetchCurrentVoter = () => requestJson("/voter/me");

export const updateCurrentVoterProfile = (payload) =>
  requestJson("/voter/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const changeCurrentVoterPassword = (payload) =>
  requestJson("/voter/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteCurrentVoterAccount = () =>
  requestJson("/voter/me", {
    method: "DELETE",
  });

export const loginCompetitor = (payload) =>
  requestJson("/competitor/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const logoutCompetitor = () =>
  requestJson("/competitor/logout", {
    method: "POST",
  });

export const fetchVoterRegistrations = (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) {
    query.set("status", params.status);
  }
  if (params.search) {
    query.set("search", params.search);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson(`/voter/admin/registrations${suffix}`);
};

export const updateVoterRegistrationStatus = (voterId, payload) =>
  requestJson(`/voter/admin/registrations/${voterId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
