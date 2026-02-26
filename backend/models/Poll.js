import mongoose from "mongoose";

const pollCompetitorSchema = new mongoose.Schema(
  {
    competitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competitor",
      required: true,
    },
    votesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

export const POLL_STATUSES = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  CLOSED: "closed",
});

const pollSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    competitors: {
      type: [pollCompetitorSchema],
      default: [],
      validate: {
        validator: (competitors) => {
          if (!Array.isArray(competitors) || competitors.length < 2) {
            return false;
          }

          const competitorIds = competitors.map((item) => String(item.competitor));
          return new Set(competitorIds).size === competitorIds.length;
        },
        message: "a poll must include at least two unique competitors",
      },
    },
    status: {
      type: String,
      enum: Object.values(POLL_STATUSES),
      default: POLL_STATUSES.DRAFT,
      index: true,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    totalVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    startNotificationSentAt: {
      type: Date,
      default: null,
      index: true,
    },
    finalResultNotificationSentAt: {
      type: Date,
      default: null,
      index: true,
    },
    cancelNotificationSentAt: {
      type: Date,
      default: null,
      index: true,
    },
    // Keep data safe: "delete" operations archive polls instead of removing them.
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

pollSchema.index({ createdAt: -1 });

pollSchema.methods.isOpenForVoting = function isOpenForVoting(referenceDate = new Date()) {
  if (this.status !== POLL_STATUSES.ACTIVE || this.isArchived) {
    return false;
  }

  if (this.startsAt && referenceDate < this.startsAt) {
    return false;
  }

  if (this.endsAt && referenceDate > this.endsAt) {
    return false;
  }

  return true;
};

const Poll = mongoose.model("Poll", pollSchema);

export default Poll;
