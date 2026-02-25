import User from "../models/User.js";
import { ROLES } from "../constants/roles.js";
import { VOTER_APPROVAL_STATUSES } from "../models/User.js";
import {
  sendVoterDecisionEmail,
  sendVoterPendingApprovalEmail,
} from "../utils/emailService.js";

const MIN_PASSWORD_LENGTH = 6;

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeEmail = (value) => normalizeText(value).toLowerCase();

const formatUser = (user) => user.toPublicJSON();

const startSession = (req, user) => {
  req.session.userId = String(user._id);
  req.session.userRole = user.role;
};

export const registerVoter = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const parsedName = normalizeText(name);
    const parsedEmail = normalizeEmail(email);

    if (!parsedName || !parsedEmail || !password) {
      return res.status(400).json({
        message: "name, email and password are required",
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const existingUser = await User.findOne({ email: parsedEmail });
    if (existingUser) {
      return res.status(409).json({
        message: "email already exists",
      });
    }

    const voter = await User.create({
      name: parsedName,
      email: parsedEmail,
      password,
      role: ROLES.USER,
      approvalStatus: VOTER_APPROVAL_STATUSES.PENDING,
    });

    const pendingEmailResult = await sendVoterPendingApprovalEmail({
      name: voter.name,
      email: voter.email,
    });

    return res.status(201).json({
      message: "voter registered successfully. wait for admin approval before login",
      voter: formatUser(voter),
      emailNotificationSent: pendingEmailResult.sent,
    });
  } catch (error) {
    return res.status(500).json({
      message: "voter registration failed",
      error: error.message,
    });
  }
};

export const loginVoter = async (req, res) => {
  try {
    const { email, password } = req.body;
    const parsedEmail = normalizeEmail(email);

    if (!parsedEmail || !password) {
      return res.status(400).json({
        message: "email and password are required",
      });
    }

    const voter = await User.findOne({ email: parsedEmail }).select("+password");
    if (!voter) { //   if  this  one had his previous email    must assig his prevoius and the email and password must  become 
      return res.status(401).json({
        message: "invalid email or password",
      });
    }

    if (voter.role !== ROLES.USER) {
      return res.status(403).json({
        message: "this account is not a voter account",
      });
    }

    const approvalStatus = voter.approvalStatus || VOTER_APPROVAL_STATUSES.PENDING;

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

    const isPasswordValid = await voter.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "invalid email or password",
      });
    }

    startSession(req, voter);

    return res.status(200).json({
      message: "voter login successful",
      voter: formatUser(voter),
    });
  } catch (error) {
    return res.status(500).json({
      message: "voter login failed",
      error: error.message,
    });
  }
};

export const logoutVoter = async (req, res) => {
  try {
    if (!req.session) {
      return res.status(200).json({
        message: "voter logged out",
      });
    }

    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({
          message: "logout failed",
          error: error.message,
        });
      }

      return res.status(200).json({
        message: "voter logged out",
      });
    });
  } catch (error) {
    return res.status(500).json({
      message: "logout failed",
      error: error.message,
    });
  }
};

export const getCurrentVoter = async (req, res) => {
  return res.status(200).json({
    voter: formatUser(req.authUser),
  });
};

export const listVoterRegistrations = async (req, res) => {
  try {
    const statusRaw = normalizeText(req.query?.status).toLowerCase();
    const search = normalizeText(req.query?.search);

    const filter = { role: ROLES.USER };
    if (statusRaw && statusRaw !== "all") {
      if (!Object.values(VOTER_APPROVAL_STATUSES).includes(statusRaw)) {
        return res.status(400).json({
          message: "invalid status value",
          allowedStatuses: [...Object.values(VOTER_APPROVAL_STATUSES), "all"],
        });
      }
      filter.approvalStatus = statusRaw;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const [voters, total, pending, approved, rejected] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .select("name email role approvalStatus approvalComment approvalReviewedAt approvalReviewedBy createdAt"),
      User.countDocuments({ role: ROLES.USER }),
      User.countDocuments({ role: ROLES.USER, approvalStatus: VOTER_APPROVAL_STATUSES.PENDING }),
      User.countDocuments({ role: ROLES.USER, approvalStatus: VOTER_APPROVAL_STATUSES.APPROVED }),
      User.countDocuments({ role: ROLES.USER, approvalStatus: VOTER_APPROVAL_STATUSES.REJECTED }),
    ]);

    return res.status(200).json({
      voters: voters.map((item) => item.toPublicJSON()),
      summary: {
        total,
        pending,
        approved,
        rejected,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to load voter registrations",
      error: error.message,
    });
  }
};

export const updateVoterApproval = async (req, res) => {
  try {
    const { voterId } = req.params;
    const status = normalizeText(req.body?.status).toLowerCase();
    const comment = normalizeText(req.body?.comment);

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "status must be approved or rejected",
      });
    }

    const voter = await User.findById(voterId);
    if (!voter || voter.role !== ROLES.USER) {
      return res.status(404).json({
        message: "voter not found",
      });
    }

    voter.approvalStatus =
      status === "approved"
        ? VOTER_APPROVAL_STATUSES.APPROVED
        : VOTER_APPROVAL_STATUSES.REJECTED;
    voter.approvalComment = comment;
    voter.approvalReviewedAt = new Date();
    voter.approvalReviewedBy = req.authUser?._id || null;
    await voter.save();

    const decisionEmailResult = await sendVoterDecisionEmail({
      name: voter.name,
      email: voter.email,
      status,
      comment,
    });

    return res.status(200).json({
      message:
        status === "approved"
          ? "voter approved successfully"
          : "voter request rejected successfully",
      voter: voter.toPublicJSON(),
      emailNotificationSent: decisionEmailResult.sent,
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to update voter approval",
      error: error.message,
    });
  }
};
