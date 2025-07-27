import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      error: "Not implemented. Document processing is handled in /api/upload.",
    },
    { status: 501 }
  );
}
