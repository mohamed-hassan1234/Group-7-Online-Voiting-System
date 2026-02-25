import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLE, ROLE_VALUES } from "../constants/roles.js";

const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
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
    // Role is validated using shared constants from one central file.
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: DEFAULT_ROLE,
    },
  },
  { timestamps: true }
);

// Hash the password only when it is new/changed.
// Mongoose v9 uses async hooks without `next` callback.
userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
  };
};

const User = mongoose.model("User", userSchema);

export default User;
