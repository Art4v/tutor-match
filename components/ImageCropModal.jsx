"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";

export function ImageCropModal({ open, file, aspect = 1, cropShape = "rect", title = "Crop image", maxOutputPx = 2400, onCancel, onConfirm }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) { setImageSrc(null); return; }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [file]);

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const onSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, maxOutputPx);
      const cropped = new File([blob], "cropped.jpg", { type: blob.type });
      onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  };

  if (!open || !imageSrc) return null;

  // A full-screen sheet below 640px. Not dismissable by Escape or the scrim: it
  // usually opens on top of another modal (editor sections, CompanyTutorModal)
  // whose own Escape listener would otherwise close both layers at once, and it
  // never had an Escape handler before. Cancel is in the footer. zIndex sits
  // above those parents (up to z-95).
  return (
    <Modal
      title={title}
      dismissable={false}
      sheet
      width={560}
      zIndex={100}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onSave} disabled={busy || !croppedAreaPixels}>
            {busy ? "Processing…" : "Use this crop"}
          </Button>
        </>
      }
    >
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
        Drag to reposition. Scroll or use the slider to zoom.
      </p>

      <div className="relative mt-4 h-[360px] overflow-hidden rounded bg-surface-2">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={cropShape}
          showGrid={cropShape === "rect"}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          restrictPosition
        />
      </div>

      <label className="mt-4 flex min-h-11 items-center gap-3">
        <span className="shrink-0 text-[14px] leading-5 font-semibold text-[color:var(--text)]">Zoom</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: "var(--accent)" }}
        />
      </label>
    </Modal>
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

// Downscale to at most maxOutputPx on the longest side and re-encode as JPEG.
// Anything bigger than its largest on-screen render (~1200 CSS px banner,
// ~90 CSS px avatar) is wasted egress on every download — the multi-MB
// originals were the main driver of the Supabase cached-egress overage.
async function getCroppedBlob(imageSrc, areaPixels, maxOutputPx) {
  const image = await loadImage(imageSrc);
  const scale = Math.min(1, maxOutputPx / Math.max(areaPixels.width, areaPixels.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(areaPixels.width * scale));
  canvas.height = Math.max(1, Math.round(areaPixels.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  // JPEG has no alpha channel — backfill white so transparent PNGs don't go black.
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    image,
    areaPixels.x, areaPixels.y, areaPixels.width, areaPixels.height,
    0, 0, canvas.width, canvas.height
  );
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
}
