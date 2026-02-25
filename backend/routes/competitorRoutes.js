import express from "express";
import {
  getCompetitorDashboard,
  getCurrentCompetitor,
  loginCompetitor,
  logoutCompetitor,
} from "../controllers/competitorAuthController.js";
import { requireCompetitor } from "../middleware/sessionAuth.js";

const router = express.Router();

router.post("/login", loginCompetitor);
router.post("/logout", requireCompetitor, logoutCompetitor);
router.get("/me", requireCompetitor, getCurrentCompetitor);
router.get("/dashboard", requireCompetitor, getCompetitorDashboard);

export default router;
