const axios = require("axios");

/**
 * analyzeSingleText(text)
 * ยิง HTTP Request ไปหา FastAPI แทนการเปิด Python ใหม่
 */
async function analyzeSingleText(text = "") {
  try {
    const response = await axios.post("http://127.0.0.1:8000/analyze", {
      text: text
    });
    return response.data;
  } catch (error) {
    console.error("❌ FastAPI Connection Error:", error.message);
    return { status: "error", sentiment: null, confidence: null };
  }
}

module.exports = analyzeSingleText;