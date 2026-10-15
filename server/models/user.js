
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
      required: false,
    },

    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },

    resetToken: {
      type: String,
      default: undefined,
    },

    resetTokenExpiry: {
      type: Date,
      default: undefined,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
