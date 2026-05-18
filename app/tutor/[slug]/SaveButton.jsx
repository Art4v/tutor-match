"use client";
import { Button } from "@/components/ui";
import { useSaved } from "@/components/SavedContext";

export function SaveButton({ tutorId, size = "md", variant = "outline", full = false }) {
  const { savedIds, toggleSave } = useSaved();
  const saved = savedIds.includes(tutorId);
  return (
    <Button
      variant={variant}
      size={size}
      icon={saved ? "bookmark-fill" : "bookmark"}
      onClick={() => toggleSave(tutorId)}
      full={full}
    >
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
