import mongoose from "mongoose";

const voteSchema = new mongoose.Schema(
  {
    poll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Poll",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    competitorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    // Backward-compatibility field for older request payloads.
    optionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      select: false,
    },
  },
  { timestamps: true }
);

voteSchema.pre("validate", function migrateLegacyVoteField() {
  if (!this.competitorId && this.optionId) {
    this.competitorId = this.optionId;
  }
});

// One user can vote only once in each poll.
voteSchema.index({ poll: 1, user: 1 }, { unique: true });
voteSchema.index({ poll: 1, competitorId: 1 });

const Vote = mongoose.model("Vote", voteSchema);

export default Vote;
