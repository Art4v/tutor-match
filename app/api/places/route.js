import { NextResponse } from "next/server";
import { searchSuburbs } from "@/lib/places";

export const runtime = "nodejs";

// GET ?q=<text> — autocomplete for Australian suburbs. Returns an array of
// { label, suburb, state, postcode, lat, lng }. Thin proxy so the client never
// calls Photon/Nominatim directly (CORS + UA-policy), mirroring /api/geocode.
export async function GET(request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchSuburbs(q);
  return NextResponse.json(results);
}
