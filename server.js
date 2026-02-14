import express from "express";
import cors from "cors";
import multer from "multer";
import { PDFDocument } from "pdf-lib";

const app = express();

app.use(cors({ origin: true }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing file" });
    }

    const pdfDoc = await PDFDocument.create();
    const bytes = req.file.buffer;

    let image;
    if (req.file.mimetype.includes("png")) {
      image = await pdfDoc.embedPng(bytes);
    } else {
      image = await pdfDoc.embedJpg(bytes);
    }

    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const dims = image.scale(1);
    const scale = Math.min(width / dims.width, height / dims.height);

    page.drawImage(image, {
      x: (width - dims.width * scale) / 2,
      y: (height - dims.height * scale) / 2,
      width: dims.width * scale,
      height: dims.height * scale,
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="cotizafacil.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Running on port", port));
