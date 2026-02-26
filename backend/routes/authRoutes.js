import express from "express";
import {
  changeCurrentUserPassword,
  deleteCurrentUserAccount,
  getAvailableRoles,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  updateCurrentUserProfile,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/sessionAuth.js";

const router = express.Router();

router.get("/roles", getAvailableRoles);
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", requireAuth, logoutUser);
router.get("/me", requireAuth, getCurrentUser);
router.patch("/me", requireAuth, updateCurrentUserProfile);
router.post("/change-password", requireAuth, changeCurrentUserPassword);
router.delete("/me", requireAuth, deleteCurrentUserAccount);

export default router;
