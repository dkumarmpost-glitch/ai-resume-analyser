const fs = require("fs");
const path = require("path");

const appJsPath = path.join(__dirname, "../../resume-analyser/src/App.js");
const appJsContent = fs.readFileSync(appJsPath, "utf8");

const lines = appJsContent.split("\n");
console.log(lines.slice(2480, 2650).join("\n"));
