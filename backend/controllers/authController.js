import User from "../models/User.js";
import { VOTER_APPROVAL_STATUSES } from "../models/User.js";
import { sendVoterPendingApprovalEmail } from "../utils/emailService.js";
import {
  DEFAULT_ROLE,
  ROLE_VALUES,
  isValidRole,
  normalizeRole,
} from "../constants/roles.js";
import { ROLES } from "../constants/roles.js";

const formatUser = (user) => user.toPublicJSON();
const startSession = (req, user) => {
  if (!req.session) {
    return;
  }

  req.session.userId = String(user._id);
  req.session.userRole = user.role;
};

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const MIN_PASSWORD_LENGTH = 6;

export const getAvailableRoles = (req, res) => {
  return res.status(200).json({
    roles: ROLE_VALUES,
    defaultRole: DEFAULT_ROLE,
  });
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const parsedRole = role ? normalizeRole(role) : DEFAULT_ROLE;

    if (!isValidRole(parsedRole)) {
      return res.status(400).json({
        message: "invalid role value",
        allowedRoles: ROLE_VALUES,
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        message: "email already exists",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: parsedRole,
      approvalStatus:
        parsedRole === ROLES.USER
          ? VOTER_APPROVAL_STATUSES.PENDING
          : VOTER_APPROVAL_STATUSES.APPROVED,
    });

    let emailNotificationSent = false;
    let emailNotificationReason = "";
    if (parsedRole === ROLES.USER) {
      const pendingEmailResult = await sendVoterPendingApprovalEmail({
        name: user.name,
        email: user.email,
      });
      emailNotificationSent = pendingEmailResult.sent;
      emailNotificationReason = pendingEmailResult.reason || "";
    }

    if (parsedRole !== ROLES.USER) {
      startSession(req, user);
    }

    return res.status(201).json({
      message:
        parsedRole === ROLES.USER
          ? "registered successfully. wait for admin approval before login"
          : "registered successfully",
      user: formatUser(user),
      emailNotificationSent,
      emailNotificationReason,
    });
  } catch (error) {
    return res.status(500).json({
      message: "registration failed",
      error: error.message,
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "invalid email or password",
      });
    }

    if (user.role === ROLES.USER) {
      const approvalStatus = user.approvalStatus || VOTER_APPROVAL_STATUSES.PENDING;

      if (approvalStatus === VOTER_APPROVAL_STATUSES.PENDING) {
        return res.status(403).json({
          message: "your account is waiting for admin approval",
        });
      }

      if (approvalStatus === VOTER_APPROVAL_STATUSES.REJECTED) {
        return res.status(403).json({
          message: "your voter account request was rejected by admin",
        });
      }
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "invalid email or password",
      });
    }
    startSession(req, user);

    return res.status(200).json({
      message: "login successful",
      user: formatUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "login failed",
      error: error.message,
    });
  }
};

export const logoutUser = async (req, res) => {
  try {
    if (!req.session) {
      return res.status(200).json({ message: "logout successful" });
    }

    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({
          message: "logout failed",
          error: error.message,
        });
      }

      return res.status(200).json({ message: "logout successful" });
    });
  } catch (error) {
    return res.status(500).json({
      message: "logout failed",
      error: error.message,
    });
  }
};

export const getCurrentUser = async (req, res) => {
  return res.status(200).json({
    user: formatUser(req.authUser),
  });
};

export const updateCurrentUserProfile = async (req, res) => {
  try {
    const user = req.authUser;
    const nextName = normalizeText(req.body?.name);
    const nextEmail = normalizeEmail(req.body?.email);

    if (!nextName || !nextEmail) {
      return res.status(400).json({
        message: "name and email are required",
      });
    }

    const existing = await User.findOne({
      email: nextEmail,
      _id: { $ne: user._id },
    }).select("_id");

    if (existing) {
      return res.status(409).json({
        message: "email already exists",
      });
    }

    user.name = nextName;
    user.email = nextEmail;
    await user.save();

    startSession(req, user);

    return res.status(200).json({
      message: "profile updated successfully",
      user: formatUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to update profile",
      error: error.message,
    });
  }
};

export const changeCurrentUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.authUser._id).select("+password");
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    const currentPassword = req.body?.currentPassword;
    const newPassword = req.body?.newPassword;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "currentPassword and newPassword are required",
      });
    }

    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `new password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "current password is invalid" });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      message: "password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to change password",
      error: error.message,
    });
  }
};

export const deleteCurrentUserAccount = async (req, res) => {
  try {
    const user = await User.findById(req.authUser._id);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    await User.deleteOne({ _id: user._id });

    if (!req.session) {
      return res.status(200).json({ message: "account deleted successfully" });
    }

    req.session.destroy((error) => {
      if (error) {
        return res.status(200).json({
          message: "account deleted successfully, but session clear failed",
        });
      }
      return res.status(200).json({ message: "account deleted successfully" });
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to delete account",
      error: error.message,
    });
  }
};
