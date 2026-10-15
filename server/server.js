const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const authRoutes = require("./routes/auth");
const resumeRoutes = require("./routes/resume");

const app = express();
app.use((req, res, next) => {
  res.setTimeout(900000); // 15 minutes (matches frontend AbortController timeout)
  next();
});

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/resume", resumeRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Resume AI Backend is running! 🚀" });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully!");
    app.listen(5000, () => {
      console.log("✅ Server running on port 5000");
    });
  })
  .catch((err) => {
    console.log("❌ Error:", err.message);
  });