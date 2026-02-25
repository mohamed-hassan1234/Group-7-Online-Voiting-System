import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(frontendRoot, "..");
const rolesModulePath = path.resolve(projectRoot, "backend", "constants", "roles.js");
const dashboardsDir = path.resolve(frontendRoot, "src", "role-dashboards");

const createDashboardTemplate = (role) => {
  const titleRole = role.charAt(0).toUpperCase() + role.slice(1);

  return `export default {
  role: "${role}",
  title: "${titleRole} Dashboard",
  subtitle: "Customize this dashboard UI when you are ready.",
  highlights: [
    "This file was created automatically from backend role constants.",
    "You can now edit this file and build your own design.",
    "Routing already works at /dashboard/${role}.",
  ],
};
`;
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const run = async () => {
  const rolesModuleUrl = pathToFileURL(rolesModulePath).href;
  const rolesModule = await import(rolesModuleUrl);
  const roleValues = Object.values(rolesModule.ROLES || {}).filter(
    (role) => typeof role === "string" && role.trim().length > 0
  );

  await fs.mkdir(dashboardsDir, { recursive: true });

  const createdFiles = [];
  for (const role of roleValues) {
    const dashboardFilePath = path.join(dashboardsDir, `${role}.dashboard.js`);
    const exists = await fileExists(dashboardFilePath);
    if (exists) {
      continue;
    }

    await fs.writeFile(dashboardFilePath, createDashboardTemplate(role), "utf8");
    createdFiles.push(path.basename(dashboardFilePath));
  }

  if (createdFiles.length > 0) {
    console.log(`Created role dashboard files: ${createdFiles.join(", ")}`);
    return;
  }

  console.log("Role dashboard files are already in sync.");
};

run().catch((error) => {
  console.error("Failed to sync role dashboards:", error.message);
  process.exit(1);
});
