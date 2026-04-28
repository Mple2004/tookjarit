function cleanText(text, isBrand = false) {
  if (!text) return "";
  let cleaned = text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  //return isBrand ? cleaned.toLowerCase() : cleaned;
  return isBrand
    ? cleaned.replace(/\b\w/g, c => c.toUpperCase())
    : cleaned;
}

async function cleanDocument(col, videoId) {
  const doc = await col.findOne({ videoId });
  if (!doc) return;

  const updatedFields = {
    title: cleanText(doc.title),
    caption: cleanText(doc.caption),
    brand: doc.brand ? cleanText(doc.brand, false) : doc.brand,
    productType: doc.productType ? cleanText(doc.productType) : doc.productType,
  };

  await col.updateOne(
    { videoId },
    { $set: updatedFields }
  );

  console.log(`🧹 Clean แล้ว:${videoId}`);
}

module.exports = cleanDocument;
