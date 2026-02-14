import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();

// CORS liberado (ajuste depois se quiser restringir ao domínio do Cotiza)
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// Upload (até 20MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Healthcheck
app.get("/health", (req, res) => {
  return res.json({ ok: true });
});

// Rota OCR (o Cotiza está chamando POST /ocr)
app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Falta el archivo (field: file)." });
    }

    // Aqui você liga o OCR de verdade (Google Vision / Tesseract etc.)
    // Por enquanto devolvo um mock pra garantir que a rota existe e não dá 404.
    // Troca esta parte pelo OCR real.
    return res.json({
      ok: true,
      mode: req.body?.mode || "B",
      filename: req.file.originalname,
      size: req.file.size,
      text: "OCR OK (placeholder). Conecta aquí el motor real.",
    });
  } catch (err) {
    console.error("OCR error:", err);
    return res.status(500).json({ error: "Error interno en OCR." });
  }
});

// Importante: Railway usa PORT dinâmica
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`OCR server running on port ${PORT}`);
});
