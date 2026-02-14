import express from "express";
import cors from "cors";
import multer from "multer";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { randomUUID } from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 20);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"] }));
app.use(express.json());

app.get("/", (req, res) => res.status(200).send("ok"));
app.get("/status", (req, res) =>
  res.json({ ok: true, service: "converter", maxFileMB: MAX_FILE_MB })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

function makeTmpDir() {
  const dir = path.join(os.tmpdir(), "cotizafacil-converter", randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function convertToPdf(inputPath, outputDir) {
  return new Promise((resolve, reject) => {
    execFile(
      "soffice",
      [
        "--headless",
        "--nologo",
        "--nofirststartwizard",
        "--norestore",
        "--convert-to",
        "pdf",
        "--outdir",
        outputDir,
        inputPath,
      ],
      { timeout: 120000 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(
            new Error(
              `LibreOffice failed: ${err.message}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`
            )
          );
        }
        resolve(true);
      }
    );
  });
}

function findPdfInDir(dir) {
  const files = fs.readdirSync(dir);
  const pdf = files.find((f) => f.toLowerCase().endsWith(".pdf"));
  if (!pdf) throw new Error("No PDF generated");
  return path.join(dir, pdf);
}

function extOf(name) {
  return path.extname(name || "").toLowerCase();
}

app.post("/convert/word", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "No file" });

    const ext = extOf(req.file.originalname);
    const allowed = [".doc", ".docx", ".rtf"];
    if (!allowed.includes(ext)) {
      return res
        .status(400)
        .json({ ok: false, error: `Formato inválido. Use: ${allowed.join(", ")}` });
    }

    const dir = makeTmpDir();
    const inputPath = path.join(dir, `input${ext}`);
    fs.writeFileSync(inputPath, req.file.buffer);

    await convertToPdf(inputPath, dir);
    const pdfPath = findPdfInDir(dir);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="convertido.pdf"');

    const stream = fs.createReadStream(pdfPath);
    stream.on("close", () => fs.rmSync(dir, { recursive: true, force: true }));
    stream.pipe(res);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/convert/excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "No file" });

    const ext = extOf(req.file.originalname);
    const allowed = [".xls", ".xlsx", ".csv"];
    if (!allowed.includes(ext)) {
      return res
        .status(400)
        .json({ ok: false, error: `Formato inválido. Use: ${allowed.join(", ")}` });
    }

    const dir = makeTmpDir();
    const inputPath = path.join(dir, `input${ext}`);
    fs.writeFileSync(inputPath, req.file.buffer);

    await convertToPdf(inputPath, dir);
    const pdfPath = findPdfInDir(dir);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="convertido.pdf"');

    const stream = fs.createReadStream(pdfPath);
    stream.on("close", () => fs.rmSync(dir, { recursive: true, force: true }));
    stream.pipe(res);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ ok: false, error: `Archivo demasiado grande. Máx ${MAX_FILE_MB} MB.` });
  }
  return next(err);
});

app.listen(PORT, () => console.log(`Converter running on :${PORT}`));
