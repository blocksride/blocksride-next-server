import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/request";
import { createPracticePosition, listPracticePositions } from "@/server/practice/positions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = requireSession(request);
    const { searchParams } = new URL(request.url);
    const isPractice = searchParams.get("is_practice") === "true";

    if (!isPractice) {
      return NextResponse.json([]);
    }

    return NextResponse.json(listPracticePositions(session.user_id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch positions";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = requireSession(request);
    const body = (await request.json().catch(() => ({}))) as {
      cell_id?: string;
      asset_id?: string;
      stake?: number;
      is_practice?: boolean;
    };

    if (!body.is_practice) {
      return NextResponse.json({ error: "Only practice positions are supported" }, { status: 400 });
    }
    if (!body.cell_id || !body.asset_id || typeof body.stake !== "number" || !Number.isFinite(body.stake) || body.stake <= 0) {
      return NextResponse.json({ error: "Invalid practice position payload" }, { status: 400 });
    }

    const position = createPracticePosition({
      userId: session.user_id,
      assetId: body.asset_id,
      cellId: body.cell_id,
      stake: body.stake
    });

    return NextResponse.json(position);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to create position";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
