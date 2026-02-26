import express from "express";
import {
  changeCompetitorPassword,
  deleteCurrentCompetitor,
  getCompetitorDashboard,
  getCurrentCompetitor,
  loginCompetitor,
  logoutCompetitor,
  updateCurrentCompetitor,
} from "../controllers/competitorAuthController.js";
import { uploadCompetitorImage } from "../middleware/upload.js";
import { requireCompetitor } from "../middleware/sessionAuth.js";

const router = express.Router();

router.post("/login", loginCompetitor);
router.post("/logout", requireCompetitor, logoutCompetitor);
router.get("/me", requireCompetitor, getCurrentCompetitor);
router.patch("/me", requireCompetitor, uploadCompetitorImage, updateCurrentCompetitor);
router.post("/change-password", requireCompetitor, changeCompetitorPassword);
router.delete("/me", requireCompetitor, deleteCurrentCompetitor);
router.get("/dashboard", requireCompetitor, getCompetitorDashboard);

export default router;
