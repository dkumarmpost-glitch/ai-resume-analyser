const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middleware/auth");

const {
  analyseResumeController,
  getHistory,
  deleteOneHistory,
  clearAllHistory,
  analyseGrammar,
} = require("../controllers/resumeController");

const {
  bestJobRolesController,
} = require("../controllers/bestJobRolesController");

// ── Multer setup ─────────────────────────────────────────────────────────────

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Only PDF, DOCX, JPG, and PNG files are allowed!"),
        false
      );
    }
  },
});

// ── Normal resume analysis ───────────────────────────────────────────────────

router.post(
  "/analyse",
  authMiddleware,
  upload.single("resume"),
  analyseResumeController
);

// ── Best Job Roles + Real Job Listings ───────────────────────────────────────

router.post(
  "/best-job-roles",
  authMiddleware,
  upload.single("resume"),
  bestJobRolesController
);

// ── History ──────────────────────────────────────────────────────────────────

router.get(
  "/history",
  authMiddleware,
  getHistory
);

router.delete(
  "/history/:id",
  authMiddleware,
  deleteOneHistory
);

router.delete(
  "/history",
  authMiddleware,
  clearAllHistory
);

// ── Grammar ──────────────────────────────────────────────────────────────────

router.post(
  "/grammar-analysis",
  authMiddleware,
  analyseGrammar
);

module.exports = router;


