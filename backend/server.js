import "./config/loadEnv.js";
import express from "express";
import cors from "cors";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import pollRoutes from "./routes/pollRoutes.js";
import voterRoutes from "./routes/voterRoutes.js";
import competitorRoutes from "./routes/competitorRoutes.js";
import { attachSessionUser } from "./middleware/sessionAuth.js";
import { runPollLifecycleTick } from "./controllers/pollController.js";

const app = express();
const port = process.env.PORT || 5010;
const configuredOrigins = String(process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([
  ...configuredOrigins,
  "http://localhost:5173",
  "https://nidwa.com",
  "https://www.nidwa.com",
])];
const lifecycleIntervalMs = Number(process.env.POLL_LIFECYCLE_INTERVAL_MS || 30000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    name: "ems.sid",
    secret: process.env.SESSION_SECRET || "dev-session-secret-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);
app.use(attachSessionUser);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.status(200).json({ message: "backend is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/competitor", competitorRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "route not found" });
});

const startServer = async () => {
  await connectDB();
  app.listen(port, () => {
    console.log(`server is running on port ${port}`);
  });

  runPollLifecycleTick().catch((error) => {
    console.error("[poll-lifecycle] initial tick failed:", error.message);
  });

  setInterval(() => {
    runPollLifecycleTick().catch((error) => {
      console.error("[poll-lifecycle] tick failed:", error.message);
    });
  }, lifecycleIntervalMs);
};

startServer();
