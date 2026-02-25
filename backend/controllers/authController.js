import User from "../models/User.js";
import {
  DEFAULT_ROLE,
  ROLE_VALUES,
  isValidRole,
  normalizeRole,
} from "../constants/roles.js";

const formatUser = (user) => user.toPublicJSON();

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
    });

    return res.status(201).json({
      message: "registered successfully",
      user: formatUser(user),
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

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "invalid email or password",
      });
    }

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
