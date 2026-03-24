const { execFile } = require("child_process");
const path = require("path");

function analyzeVideo(url, title = "None", description = "None", brandList = []) {
  const brandListArg = JSON.stringify(brandList);

  // ✅ ใช้ path แบบ absolute กันพังเวลา cwd เปลี่ยน
  const scriptPath = path.join(__dirname, "gemeni.py");

  const options = {
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
    cwd: __dirname, // ✅ ให้ python หา .env ถูก
  };

  return new Promise((resolve, reject) => {
    execFile(
      "python",
      [scriptPath, url, brandListArg, title, description],
      options,
      (error, stdout, stderr) => {
        if (error) {
          console.error("❌ Python Bridge Error:", stderr);
          return reject(error);
        }

        try {
          const cleaned = stdout
            .toString("utf8")
            .replace(/^\uFEFF/, "")
            .trim();

          const match = cleaned.match(/\{[\s\S]*\}/);
          if (!match) throw new Error("No JSON found in Python output");

          const data = JSON.parse(match[0]);

          resolve({
            status: data.status ?? "error",
            brand: data.brand ?? null,
            productType: data.productType ?? null, 
            category: data.category ?? null,    
          });
        } catch (err) {
          console.error("❌ Parsing Error. Raw output:\n", stdout);
          reject("Invalid JSON from Python");
        }
      }
    );
  });
}

module.exports = analyzeVideo;