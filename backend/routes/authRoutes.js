import express from "express";
import {
  getAvailableRoles,
  loginUser,
  registerUser,
} from "../controllers/authController.js";

const router = express.Router();

router.get("/roles", getAvailableRoles);
router.post("/register", registerUser);
router.post("/login", loginUser);

export default router;
