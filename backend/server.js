import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import pollRoutes from "./routes/pollRoutes.js";
import voterRoutes from "./routes/voterRoutes.js";
import competitorRoutes from "./routes/competitorRoutes.js";
import { attachSessionUser } from "./middleware/sessionAuth.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5010;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: clientUrl,
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
};

startServer();
