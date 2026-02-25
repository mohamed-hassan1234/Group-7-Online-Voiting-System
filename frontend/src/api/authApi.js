import { API_BASE_URL } from "../config/env.js";

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
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
