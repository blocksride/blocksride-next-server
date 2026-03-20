import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gridId: string }>;
};

export async function GET(_request: Request, _context: RouteContext) {
  return NextResponse.json([]);
}
