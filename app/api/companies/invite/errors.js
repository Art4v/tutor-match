import { NextResponse } from "next/server";

// Maps the errcodes the 0068 inviter RPCs raise onto HTTP statuses, so both
// invite routes answer the same way. 42501 = not an inviter, 22023 = bad input
// (its message is written to be shown as-is).
export function inviteRpcErrorResponse(error, fallback) {
  if (error?.code === "42501") {
    return NextResponse.json({ error: "You don't have permission to invite companies." }, { status: 403 });
  }
  if (error?.code === "22023") {
    const msg = error.message ? error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." : fallback;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}
