import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export const COMPETITOR_SEX_VALUES = Object.freeze(["male", "female", "other"]);

const competitorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    sex: {
      type: String,
      enum: COMPETITOR_SEX_VALUES,
      required: true,
      lowercase: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

competitorSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

competitorSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

competitorSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: "competitor",
    phone: this.phone,
    sex: this.sex,
    imageUrl: this.imageUrl,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Competitor = mongoose.model("Competitor", competitorSchema);

export default Competitor;
