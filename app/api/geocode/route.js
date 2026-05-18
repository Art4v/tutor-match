import { NextResponse } from "next/server";
import { geocodeSuburb } from "@/lib/geocode";

export const runtime = "nodejs";

export async function GET(request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const result = await geocodeSuburb(q);
  return NextResponse.json(result ?? { lat: null, lng: null });
}
