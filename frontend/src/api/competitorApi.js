import { requestJson } from "./authApi.js";

export const fetchCompetitorDashboard = () => requestJson("/competitor/dashboard");

export const fetchCurrentCompetitor = () => requestJson("/competitor/me");
