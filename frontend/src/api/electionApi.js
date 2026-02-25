import { requestJson } from "./authApi.js";

const appendIfValue = (formData, key, value) => {
  if (value === undefined || value === null || value === "") {
    return;
  }
  formData.append(key, value);
};

export const createCompetitor = (payload) => {
  const formData = new FormData();
  appendIfValue(formData, "name", payload?.name);
  appendIfValue(formData, "email", payload?.email);
  appendIfValue(formData, "password", payload?.password);
  appendIfValue(formData, "phone", payload?.phone);
  appendIfValue(formData, "sex", payload?.sex);
  if (payload?.image) {
    formData.append("image", payload.image);
  }

  return requestJson("/polls/admin/competitors", {
    method: "POST",
    body: formData,
  });
};

export const fetchCompetitors = () => requestJson("/polls/admin/competitors");

export const createElection = (payload) => {
  const formData = new FormData();
  appendIfValue(formData, "title", payload?.title);
  appendIfValue(formData, "description", payload?.description);
  appendIfValue(formData, "status", payload?.status);
  appendIfValue(formData, "startsAt", payload?.startsAt);
  appendIfValue(formData, "endsAt", payload?.endsAt);
  formData.append("competitorIds", JSON.stringify(payload?.competitorIds || []));
  if (payload?.image) {
    formData.append("image", payload.image);
  }

  return requestJson("/polls/admin", {
    method: "POST",
    body: formData,
  });
};

export const fetchElections = () => requestJson("/polls");

export const updateElectionStatus = (pollId, status) =>
  requestJson(`/polls/admin/${pollId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const fetchElectionResults = (pollId) => requestJson(`/polls/${pollId}/results`);

export const fetchVoterElections = () => requestJson("/voter/elections");

export const fetchVoterElectionCompetitors = (pollId) =>
  requestJson(`/voter/elections/${pollId}/competitors`);

export const voteForCompetitor = (pollId, competitorId) =>
  requestJson(`/voter/elections/${pollId}/vote`, {
    method: "POST",
    body: JSON.stringify({ competitorId }),
  });

export const fetchVoterElectionResults = (pollId) =>
  requestJson(`/voter/elections/${pollId}/results`);
