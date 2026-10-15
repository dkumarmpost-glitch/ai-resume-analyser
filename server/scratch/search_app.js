const fs = require("fs");
const path = require("path");

const appJsPath = path.join(__dirname, "../../resume-analyser/src/App.js");
const appJsContent = fs.readFileSync(appJsPath, "utf8");

const lines = appJsContent.split("\n");
lines.forEach((line, i) => {
  if (line.toLowerCase().includes("language") || line.toLowerCase().includes("proficiency") || line.toLowerCase().includes("sectionsanalysis")) {
    console.log(`Line ${i + 1}: ${line.trim().slice(0, 150)}`);
  }
});
