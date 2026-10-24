import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
}

// Worker cache to prevent wasteful re-downloads
let activeWorker = null;
let activeLang = null;

/**
 * Preprocesses image on a canvas for enhanced Hindi/English OCR.
 * Preserves delicate Devanagari matras, anusvara, and diacritics.
 */
export async function preprocessImage(imageElement, options = {}) {
  const {
    grayscale = true,
    contrast = 25,
    binarize = false,
    sharpen = false,
    rotation = 0
  } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let width = imageElement.naturalWidth || imageElement.width || 800;
  let height = imageElement.naturalHeight || imageElement.height || 600;

  // Handle rotation
  if (rotation === 90 || rotation === 270) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.save();
  if (rotation === 90) {
    ctx.translate(height, 0);
    ctx.rotate((90 * Math.PI) / 180);
  } else if (rotation === 180) {
    ctx.translate(width, height);
    ctx.rotate((180 * Math.PI) / 180);
  } else if (rotation === 270) {
    ctx.translate(0, width);
    ctx.rotate((270 * Math.PI) / 180);
  }

  ctx.drawImage(imageElement, 0, 0, width, height);
  ctx.restore();

  if (!grayscale && contrast === 0 && !binarize && !sharpen) {
    return canvas;
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Contrast factor calculation
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (grayscale) {
      // Luminance weights (Rec. 709)
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = gray;
      g = gray;
      b = gray;
    }

    if (contrast !== 0) {
      r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, factor * (b - 128) + 128));
    }

    if (binarize) {
      // Conservative threshold preserving thin Hindi matras
      const val = (r + g + b) / 3;
      const threshold = 135;
      const finalVal = val > threshold ? 255 : 0;
      r = finalVal;
      g = finalVal;
      b = finalVal;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);

  // Optional mild 3x3 convolution sharpening
  if (sharpen) {
    const sharpCanvas = document.createElement('canvas');
    sharpCanvas.width = canvas.width;
    sharpCanvas.height = canvas.height;
    const sharpCtx = sharpCanvas.getContext('2d');
    sharpCtx.drawImage(canvas, 0, 0);

    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const dst = sharpCtx.createImageData(canvas.width, canvas.height);
    const s = src.data;
    const d = dst.data;
    const w = canvas.width;
    const h = canvas.height;

    const kernel = [
       0, -0.5,  0,
      -0.5,  3, -0.5,
       0, -0.5,  0
    ];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let acc = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4;
            acc += s[idx] * kernel[ki++];
          }
        }
        const outIdx = (y * w + x) * 4;
        const clamped = Math.min(255, Math.max(0, acc));
        d[outIdx] = clamped;
        d[outIdx + 1] = clamped;
        d[outIdx + 2] = clamped;
        d[outIdx + 3] = 255;
      }
    }
    return sharpCanvas;
  }

  return canvas;
}

/**
 * Renders a PDF page to a canvas with 2.0x DPI scale for optimal OCR clarity.
 */
export async function renderPdfPageToCanvas(pdfArrayBuffer, pageNumber = 1) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), numPages));
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    return {
      canvas,
      numPages,
      currentPage: pageNumber
    };
  } catch (err) {
    console.error('[PDF] Error rendering page:', err);
    throw new Error(`Failed to render PDF: ${err.message}`);
  }
}

/**
 * Helper to safely extract an error message string
 */
function extractErrorMessage(err) {
  if (!err) return 'Unknown OCR processing error';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  if (typeof err.status === 'string' && err.status.trim()) return err.status.trim();
  if (err.target && err.target.error) return extractErrorMessage(err.target.error);
  try {
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== '{}') return serialized;
  } catch {}
  return String(err);
}

/**
 * Reusable worker instance manager for Tesseract.js
 */
export async function getOcrWorker(lang = 'eng+hin', onProgress = () => {}) {
  // If active worker exists and language matches, reuse it!
  if (activeWorker && activeLang === lang) {
    return activeWorker;
  }

  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch (e) {
      console.warn('[OCR] Error terminating previous worker:', e);
    }
    activeWorker = null;
    activeLang = null;
  }

  const createOptions = {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5.1.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.1.0/tesseract-core-simd-lstm.wasm.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: m => {
      if (!m) return;
      if (m.status === 'recognizing text') {
        const pct = Math.round(Number(m.progress || 0) * 100);
        onProgress({ phase: 'recognizing', progress: Math.min(100, Math.max(0, pct)), status: 'Recognizing text…' });
      } else {
        const pct = Math.round(Number(m.progress || 0) * 100);
        onProgress({ phase: 'loading', progress: Math.min(100, Math.max(0, pct)), status: m.status || 'Loading OCR models…' });
      }
    },
    errorHandler: err => {
      console.warn('[OCR Worker Warning]:', err);
    }
  };

  try {
    const worker = await createWorker(lang, 1, createOptions);
    activeWorker = worker;
    activeLang = lang;
    return activeWorker;
  } catch (initialErr) {
    console.warn(`[OCR Engine] Primary load failed for "${lang}":`, extractErrorMessage(initialErr));
    // If combined language failed (e.g. hin dataset blocked/timed out), retry with reliable english model
    if (lang !== 'eng') {
      try {
        console.info('[OCR Engine] Falling back to standard "eng" language model...');
        onProgress({ phase: 'loading', progress: 30, status: 'Retrying with English language model…' });
        const fallbackWorker = await createWorker('eng', 1, createOptions);
        activeWorker = fallbackWorker;
        activeLang = 'eng';
        return activeWorker;
      } catch (fallbackErr) {
        throw new Error(`OCR initialization failed: ${extractErrorMessage(fallbackErr)}`);
      }
    }
    throw new Error(`OCR initialization failed: ${extractErrorMessage(initialErr)}`);
  }
}

/**
 * Perform recognition on image or canvas
 */
export async function performOcr(imageOrCanvas, lang = 'eng+hin', onProgress = () => {}) {
  try {
    const worker = await getOcrWorker(lang, onProgress);
    if (!worker || typeof worker.recognize !== 'function') {
      throw new Error('OCR worker instance is unavailable or failed to initialize.');
    }

    const result = await worker.recognize(imageOrCanvas);
    const data = result?.data || {};
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    const confidence = typeof data.confidence === 'number' ? Math.round(data.confidence) : 0;
    const words = Array.isArray(data.words) ? data.words : [];
    const lines = Array.isArray(data.lines) ? data.lines : [];

    return {
      text,
      confidence,
      words,
      lines
    };
  } catch (err) {
    console.error('[OCR Recognition Error]:', err);
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Terminate cached worker on unmount
 */
export async function cleanupOcrWorker() {
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch {}
    activeWorker = null;
    activeLang = null;
  }
}
