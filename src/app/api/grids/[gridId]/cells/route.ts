import { NextResponse } from "next/server";

import { getSyntheticCells } from "@/server/grid/synthetic";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    gridId: string;
  }>;
};

export async function GET(_: Request, { params }: Params) {
  const { gridId } = await params;
  return NextResponse.json(getSyntheticCells(gridId));
}
