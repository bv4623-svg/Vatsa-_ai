const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PUBLIC = path.join(__dirname, "..", "public");
const SOURCE = path.join(PUBLIC, "logo.png");
const BACKUP = path.join(PUBLIC, "logo-source.png");

async function main() {
  const before = fs.statSync(SOURCE).size;

  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(SOURCE, BACKUP);
  }

  const buf = await sharp(BACKUP)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(SOURCE, buf);

  const after = fs.statSync(SOURCE).size;
  console.log(`logo-source.png (backup): ${(before / 1024 / 1024).toFixed(2)} MB`);
  console.log(`logo.png (optimized):      ${(after / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
