import { requestJson } from "./authApi.js";

const appendIfValue = (formData, key, value) => {
  if (value === undefined || value === null || value === "") {
    return;
  }
  formData.append(key, value);
};

const MAX_UPLOAD_IMAGE_BYTES = Number(import.meta.env.VITE_MAX_UPLOAD_IMAGE_BYTES || 900 * 1024);
const MAX_UPLOAD_IMAGE_DIMENSION = 1600;

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

const toCompressedFileName = (originalName) => {
  const safeName = String(originalName || "image").replace(/\.[^.]+$/, "");
  return `${safeName}-compressed.jpg`;
};

const prepareImageFileForUpload = async (file) => {
  if (!file || !(file instanceof File) || !String(file.type || "").startsWith("image/")) {
    return file;
  }

  if (file.size <= MAX_UPLOAD_IMAGE_BYTES) {
    return file;
  }

  try {
    const sourceImage = await loadImageFromFile(file);
    const scale = Math.min(
      1,
      MAX_UPLOAD_IMAGE_DIMENSION / sourceImage.width,
      MAX_UPLOAD_IMAGE_DIMENSION / sourceImage.height
    );
    let width = Math.max(1, Math.round(sourceImage.width * scale));
    let height = Math.max(1, Math.round(sourceImage.height * scale));

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    let bestBlob = null;
    for (let pass = 0; pass < 3; pass += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(sourceImage, 0, 0, width, height);

      const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, "image/jpeg", quality);
        if (!blob) continue;
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
        }
        if (blob.size <= MAX_UPLOAD_IMAGE_BYTES) {
          return new File([blob], toCompressedFileName(file.name), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
        }
      }

      width = Math.max(600, Math.round(width * 0.85));
      height = Math.max(600, Math.round(height * 0.85));
    }

    if (bestBlob && bestBlob.size < file.size) {
      return new File([bestBlob], toCompressedFileName(file.name), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }
  } catch {
    // Keep original file if compression fails.
  }

  return file;
};

export const createCompetitor = async (payload) => {
  const formData = new FormData();
  appendIfValue(formData, "name", payload?.name);
  appendIfValue(formData, "email", payload?.email);
  appendIfValue(formData, "password", payload?.password);
  appendIfValue(formData, "phone", payload?.phone);
  appendIfValue(formData, "sex", payload?.sex);
  if (payload?.image) {
    formData.append("image", await prepareImageFileForUpload(payload.image));
  }

  return requestJson("/polls/admin/competitors", {
    method: "POST",
    body: formData,
  });
};

export const fetchCompetitors = () => requestJson("/polls/admin/competitors");

export const updateCompetitor = async (competitorId, payload) => {
  const formData = new FormData();
  appendIfValue(formData, "name", payload?.name);
  appendIfValue(formData, "email", payload?.email);
  appendIfValue(formData, "phone", payload?.phone);
  appendIfValue(formData, "sex", payload?.sex);
  appendIfValue(formData, "password", payload?.password);
  if (payload?.image) {
    formData.append("image", await prepareImageFileForUpload(payload.image));
  }

  return requestJson(`/polls/admin/competitors/${competitorId}`, {
    method: "PATCH",
    body: formData,
  });
};

export const deleteCompetitor = (competitorId) =>
  requestJson(`/polls/admin/competitors/${competitorId}`, {
    method: "DELETE",
  });

export const createElection = async (payload) => {
  const formData = new FormData();
  appendIfValue(formData, "title", payload?.title);
  appendIfValue(formData, "description", payload?.description);
  appendIfValue(formData, "status", payload?.status);
  appendIfValue(formData, "startsAt", payload?.startsAt);
  appendIfValue(formData, "endsAt", payload?.endsAt);
  formData.append("competitorIds", JSON.stringify(payload?.competitorIds || []));
  if (payload?.image) {
    formData.append("image", await prepareImageFileForUpload(payload.image));
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

export const fetchAdminVoteAudit = (params = {}) => {
  const query = new URLSearchParams();
  if (params.pollId && params.pollId !== "all") {
    query.set("pollId", params.pollId);
  }
  if (params.search) {
    query.set("search", params.search);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson(`/polls/admin/votes${suffix}`);
};

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
