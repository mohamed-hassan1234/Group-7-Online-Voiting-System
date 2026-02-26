const normalizeBaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw.replace(/\/+$/, "");
};

const getConfiguredBaseUrl = () => normalizeBaseUrl(process.env.PUBLIC_BASE_URL);

const extractUploadRelativePath = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname || "";
    } catch {
      pathname = raw;
    }
  }

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

export const normalizeUploadedAssetUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const base = getConfiguredBaseUrl();
  const uploadPath = extractUploadRelativePath(raw);
  if (uploadPath) {
    return base ? `${base}${uploadPath}` : uploadPath;
  }

  if (/^https?:\/\//i.test(raw)) {
    if (base.startsWith("https://")) {
      try {
        const parsed = new URL(raw);
        const baseHost = new URL(base).host;
        if (parsed.host === baseHost && parsed.protocol === "http:") {
          parsed.protocol = "https:";
          return parsed.toString();
        }
      } catch {
        // Keep raw value if URL parsing fails.
      }
    }
    return raw;
  }

  if (raw.startsWith("/")) {
    return base ? `${base}${raw}` : raw;
  }

  return raw;
};

export const buildUploadedAssetUrl = (subFolder, fileName) => {
  if (!subFolder || !fileName) {
    return "";
  }

  const path = `/api/uploads/${subFolder}/${fileName}`;
  const base = getConfiguredBaseUrl();
  return base ? `${base}${path}` : path;
};
