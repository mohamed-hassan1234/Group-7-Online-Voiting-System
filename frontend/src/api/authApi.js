import { API_BASE_URL } from "../config/env.js";

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

  return responseData;
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
