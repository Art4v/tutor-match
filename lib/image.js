// ============================================================================
// Client-side image downscaling, for uploads that need a known output size.
// ----------------------------------------------------------------------------
// BROWSER ONLY. Everything here touches document/canvas, so it must be called
// from a client component. There is no "use client" directive because this is a
// plain module, not a component: the directive belongs on whoever imports it.
// It is safe to sit in the server graph (lib/supabase/storage.js imports it,
// and app/tutor/[slug]/page.js imports that) because nothing runs at module
// load and `document` is only touched inside a function body.
//
// Modelled on getCroppedBlob in components/ImageCropModal.jsx, with two
// differences: an object URL instead of a FileReader data URL, so a 20 MB
// original is not base64-inflated on the way in; and no white backfill, because
// the output is WebP, which has an alpha channel where JPEG does not.
// ============================================================================

// Roughly 2x the article column, so a figure stays sharp on a retina screen
// without shipping a phone camera's full 4000px original to every reader.
export const BODY_IMAGE_MAX_EDGE = 1600;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Downscale to at most maxEdge on the long side and re-encode.
 * Returns { blob, width, height }, or null if the file could not be decoded.
 *
 * THE DIMENSIONS ARE THE CONTRACT. They are measured off the canvas, AFTER
 * scaling, because they end up in the filename and are therefore what the
 * rendered <img> actually has. Never report the source dimensions here.
 *
 * Callers must read blob.type back rather than assuming WebP: canvas.toBlob
 * silently falls back to image/png where WebP encoding is unsupported, and a
 * .webp name holding PNG bytes is a lie the CDN would serve for a year.
 */
export async function downscaleImage(file, { maxEdge = BODY_IMAGE_MAX_EDGE, quality = 0.85 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    // An SVG with no intrinsic size lands here. Bailing is the right answer:
    // re-encoding through a canvas is also what stops an SVG reaching a public
    // bucket at all, which is a security win rather than a limitation.
    if (!sw || !sh) return null;

    const scale = Math.min(1, maxEdge / Math.max(sw, sh));
    const width = Math.max(1, Math.round(sw * scale));
    const height = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", quality),
    );
    if (!blob) return null;
    return { blob, width, height };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
