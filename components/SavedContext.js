"use client";
import { createContext, useContext, useState, useCallback } from "react";

const SavedContext = createContext(null);

export function SavedProvider({ children }) {
  const [savedIds, setSavedIds] = useState([]);
  const toggleSave = useCallback((id) => {
    setSavedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);
  return (
    <SavedContext.Provider value={{ savedIds, toggleSave }}>{children}</SavedContext.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) return { savedIds: [], toggleSave: () => {} };
  return ctx;
}
