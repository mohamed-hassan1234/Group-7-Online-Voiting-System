import { requestJson } from "./authApi.js";

export const fetchCompetitorDashboard = () => requestJson("/competitor/dashboard");

export const fetchCurrentCompetitor = () => requestJson("/competitor/me");

export const updateCurrentCompetitorProfile = (payload) => {
  const formData = new FormData();
  if (payload?.name !== undefined) formData.append("name", payload.name);
  if (payload?.email !== undefined) formData.append("email", payload.email);
  if (payload?.phone !== undefined) formData.append("phone", payload.phone);
  if (payload?.sex !== undefined) formData.append("sex", payload.sex);
  if (payload?.image) formData.append("image", payload.image);

  return requestJson("/competitor/me", {
    method: "PATCH",
    body: formData,
  });
};

export const changeCompetitorPassword = (payload) =>
  requestJson("/competitor/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteCurrentCompetitorAccount = () =>
  requestJson("/competitor/me", {
    method: "DELETE",
  });
