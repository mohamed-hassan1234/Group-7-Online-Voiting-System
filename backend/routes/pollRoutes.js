import express from "express";
import {
  addPollCompetitors,
  archivePoll,
  castVote,
  createCompetitor,
  createPoll,
  getDashboardOverview,
  getPollById,
  getPollResults,
  listPollCompetitors,
  listCompetitors,
  listPolls,
  removePollCompetitor,
  replacePollCompetitors,
  streamPollResults,
  updatePoll,
  updatePollStatus,
} from "../controllers/pollController.js";
import { uploadCompetitorImage, uploadPollImage } from "../middleware/upload.js";

const router = express.Router();

// Admin management
router.post("/admin", uploadPollImage, createPoll);
router.post("/admin/competitors", uploadCompetitorImage, createCompetitor);
router.get("/admin/competitors", listCompetitors);
router.patch("/admin/:pollId", uploadPollImage, updatePoll);
router.patch("/admin/:pollId/status", updatePollStatus);
router.post("/admin/:pollId/competitors", addPollCompetitors);
router.put("/admin/:pollId/competitors", replacePollCompetitors);
router.delete("/admin/:pollId/competitors/:competitorId", removePollCompetitor);
router.delete("/admin/:pollId", archivePoll);
router.get("/dashboard/overview", getDashboardOverview);

// Poll browsing and voting
router.get("/", listPolls);
router.get("/:pollId/competitors", listPollCompetitors);
router.get("/:pollId", getPollById);
router.get("/:pollId/results", getPollResults);
router.get("/:pollId/stream", streamPollResults);
router.post("/:pollId/vote", castVote);

export default router;
