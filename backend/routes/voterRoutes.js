import express from "express";
import { ROLES } from "../constants/roles.js";
import {
  changeCurrentVoterPassword,
  deleteCurrentVoter,
  getCurrentVoter,
  loginVoter,
  listVoterRegistrations,
  logoutVoter,
  registerVoter,
  updateCurrentVoter,
  updateVoterApproval,
} from "../controllers/voterAuthController.js";
import {
  castVote,
  getPollById,
  getPollResults,
  listPollCompetitors,
  listPolls,
} from "../controllers/pollController.js";
import { requireAuth, requireRole } from "../middleware/sessionAuth.js";

const router = express.Router();

// Voter account
router.post("/register", registerVoter);
router.post("/login", loginVoter);
router.post("/logout", requireAuth, logoutVoter);
router.get("/me", requireAuth, requireRole(ROLES.USER), getCurrentVoter);
router.patch("/me", requireAuth, requireRole(ROLES.USER), updateCurrentVoter);
router.post("/change-password", requireAuth, requireRole(ROLES.USER), changeCurrentVoterPassword);
router.delete("/me", requireAuth, requireRole(ROLES.USER), deleteCurrentVoter);
router.get("/admin/registrations", requireAuth, requireRole(ROLES.ADMIN), listVoterRegistrations);
router.patch("/admin/registrations/:voterId", requireAuth, requireRole(ROLES.ADMIN), updateVoterApproval);

// Voter election actions
router.get("/elections", requireAuth, requireRole(ROLES.USER), listPolls);
router.get("/elections/:pollId", requireAuth, requireRole(ROLES.USER), getPollById);
router.get("/elections/:pollId/competitors", requireAuth, requireRole(ROLES.USER), listPollCompetitors);
router.get("/elections/:pollId/results", requireAuth, requireRole(ROLES.USER), getPollResults);
router.post("/elections/:pollId/vote", requireAuth, requireRole(ROLES.USER), castVote);

export default router;
