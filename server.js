const express = require("express");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const vision = require("@google-cloud/vision");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const app = express();

// limite 20MB
const upload = multer({
  limits: { fileSize: 20 * 1024 * 1024 }
});

// Supabase (service role — backend only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Google Vision OCR
const client = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
});

// limite free
const FREE_LIMIT = parseInt(process.env.FREE_OCR_LIMIT || "3");

// Healthcheck (pra testar no Railway)
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Controle de limite gratuito
async function checkLimit(user_id) {
  const { data } = await supabase
    .from("ocr_usage")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();

  if (!data) {
    await supabase.from("ocr_usage").insert({
      user_id,
      free_count: 1
    });
    return;
  }

  if (data.free_count >= FREE_LIMIT) {
    throw new Error("LIMIT");
  }

  await supabase
    .from("ocr_usage")
    .update({ free_count: data.free_count + 1 })
    .eq("user_id", user_id);
}

// Endpoint OCR → PDF
app.post("/ocr/image-to-pdf", upload.single("file"), async (req, res) => {
  try {
    const { mode, user_id } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Archivo no enviado." });
    }

    if (!user_id) {
      return res.status(400).json({ error: "Usuario no identificado." });
    }

    // verifica limite free
    await checkLimit(user_id);

    // OCR
    const [result] = await client.textDetection(req.file.buffer);
    const text = result.fullTextAnnotation?.text || "No se detectó texto.";

    // cria PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const page = pdfDoc.addPage();
    page.drawText(text, {
      x: 50,
      y: page.getHeight() - 50,
      size: 10,
      font,
      maxWidth: page.getWidth() - 100
    });

    // modo B → anexa imagem original
    if (mode === "B") {
      const mimetype = req.file.mimetype || "";
      const isPng = mimetype.includes("png");

      const image = isPng
        ? await pdfDoc.embedPng(req.file.buffer)
        : await pdfDoc.embedJpg(req.file.buffer);

      const imgPage = pdfDoc.addPage();

      imgPage.drawImage(image, {
        x: 0,
        y: 0,
        width: imgPage.getWidth(),
        height: imgPage.getHeight()
      });
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=documento.pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    if (err.message === "LIMIT") {
      return res.status(403).json({
        error: "Límite gratuito alcanzado (3 conversiones)."
      });
    }

    console.error(err);
    res.status(500).json({
      error: "Error procesando la imagen."
    });
  }
});

// porta Railway
app.listen(8080, () => console.log("OCR service running on port 8080"));
