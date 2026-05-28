"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui";

export function ImageCropModal({ open, file, aspect = 1, cropShape = "rect", title = "Crop image", onCancel, onConfirm }) {
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
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, file?.type || "image/jpeg");
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const cropped = new File([blob], `cropped.${ext}`, { type: blob.type });
      onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  };

  if (!open || !imageSrc) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-[560px] flex flex-col"
        style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(15,23,42,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
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
            style={{ accentColor: "#0F172A" }}
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

async function getCroppedBlob(imageSrc, areaPixels, mimeType) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = areaPixels.width;
  canvas.height = areaPixels.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    areaPixels.x, areaPixels.y, areaPixels.width, areaPixels.height,
    0, 0, areaPixels.width, areaPixels.height
  );
  const outType = mimeType === "image/png" ? "image/png" : "image/jpeg";
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), outType, 0.92));
}
