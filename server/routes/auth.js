const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);
const User = require("../models/user");

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Wrong password" });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// FORGOT PASSWORD
// Generates a reset token and saves it to the user document.
// ⚠️  PRODUCTION NOTE: In a real app you would NOT return resetToken in the response.
//     Instead, send it to the user's email via Nodemailer / SendGrid / Resend, etc.
//     e.g.  await transporter.sendMail({ to: user.email, subject: "Reset your password",
//             text: `Click: https://yourapp.com/reset?token=${resetToken}` });
//     The direct token return below is a TEMPORARY testing shortcut only.
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const genericMsg = "If an account exists for this email, a reset link has been generated.";

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether the email exists (security best-practice)
      return res.json({ message: genericMsg });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken       = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 3_600_000); // 1 hour from now
    await user.save();

    // ── TESTING SHORTCUT ─────────────────────────────────────────────────────
    // In production: email the token instead of returning it here.
    res.json({
      message: genericMsg,
      resetToken, // remove this line and add email delivery in production
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// RESET PASSWORD
// Validates the token (must exist and not be expired), then sets the new password.
router.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    const user = await User.findOne({
      resetToken,
      resetTokenExpiry: { $gt: new Date() }, // token must not be expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link." });
    }

    user.password         = await bcrypt.hash(newPassword, 10); // same salt rounds as signup
    user.resetToken       = undefined;  // invalidate immediately after use
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* GOOGLE LOGIN */
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required.",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.status(401).json({
        message: "Google account verification failed.",
      });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0];

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (user) {
      // Do not automatically link an existing password account.
      if (!user.googleId) {
        return res.status(409).json({
          message:
            "An account already exists with this email. Please log in using your password first.",
        });
      }

      if (user.googleId !== googleId) {
        return res.status(409).json({
          message: "This Google account is not linked to this user.",
        });
      }
    } else {
      user = await User.create({
        name,
        email,
        googleId,
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("[GOOGLE LOGIN]", err.message);

    return res.status(401).json({
      message: "Google login failed. Please try again.",
    });
  }
});



module.exports = router;
