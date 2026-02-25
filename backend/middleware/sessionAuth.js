import mongoose from "mongoose";
import User from "../models/User.js";
import Competitor from "../models/Competitor.js";

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

export const attachSessionUser = async (req, res, next) => {
  try {
    const sessionUserId = req.session?.userId;
    if (sessionUserId && isValidObjectId(sessionUserId)) {
      const user = await User.findById(sessionUserId);
      if (!user) {
        req.session.userId = undefined;
        req.session.userRole = undefined;
      } else {
        req.authUser = user;
        req.authActor = user;
        return next();
      }
    }

    const sessionCompetitorId = req.session?.competitorId;
    if (sessionCompetitorId && isValidObjectId(sessionCompetitorId)) {
      const competitor = await Competitor.findById(sessionCompetitorId);
      if (!competitor) {
        req.session.competitorId = undefined;
      } else {
        req.authCompetitor = competitor;
        req.authActor = competitor;
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAuth = (req, res, next) => {
  if (!req.authUser) {
    return res.status(401).json({
      message: "authentication required. login first",
    });
  }

  return next();
};

export const requireCompetitor = (req, res, next) => {
  if (!req.authCompetitor) {
    return res.status(401).json({
      message: "competitor authentication required. login first",
    });
  }

  return next();
};

export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.authUser) {
    return res.status(401).json({
      message: "authentication required. login first",
    });
  }

  if (!allowedRoles.includes(req.authUser.role)) {
    return res.status(403).json({
      message: "you do not have permission for this action",
    });
  }

  return next();
};
