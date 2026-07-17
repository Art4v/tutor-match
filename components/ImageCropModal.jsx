"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui";

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,30,30,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full max-w-[560px] flex flex-col"
        style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,30,30,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--desk)" }}>
          <h3 className="text-[15px] font-light text-slate-800">{title}</h3>
          <p className="text-[12.5px] text-slate-500 mt-0.5">Drag to reposition, scroll or use the slider to zoom.</p>
        </div>

        <div className="relative bg-slate-900" style={{ height: 360 }}>
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

        <div className="px-5 py-4 flex items-center gap-3">
          <span className="text-[12px] text-slate-500 shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: "var(--ink)" }}
          />
        </div>

        <div className="px-5 pb-5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onSave} disabled={busy || !croppedAreaPixels}>
            {busy ? "Processing…" : "Use this crop"}
          </Button>
        </div>
      </div>
    </div>
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
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    image,
    areaPixels.x, areaPixels.y, areaPixels.width, areaPixels.height,
    0, 0, canvas.width, canvas.height
  );
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
}
