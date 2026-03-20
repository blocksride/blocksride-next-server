import { NextResponse } from "next/server";

import { getRideById } from "@/server/supabase/client";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ contestId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { contestId } = await context.params;
    const contest = await getRideById(contestId);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    return NextResponse.json(contest);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch contest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
