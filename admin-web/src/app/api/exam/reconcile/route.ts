import { NextRequest, NextResponse } from "next/server";
import { reconcileExamStatuses } from "@/lib/exam-reconciliation";

export const dynamic = "force-dynamic";

/**
 * GET /api/exam/reconcile
 * Trigger deterministic exam status reconciliation against authoritative IST server time.
 */
export async function GET(req: NextRequest) {
  try {
    const targetExamId = req.nextUrl.searchParams.get("examId") || undefined;
    const result = await reconcileExamStatuses(targetExamId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to reconcile exam statuses." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/exam/reconcile
 */
export async function POST(req: NextRequest) {
  try {
    let targetExamId: string | undefined = undefined;
    try {
      const body = await req.json();
      targetExamId = body?.examId;
    } catch {
      // No JSON body provided, reconcile all
    }
    const result = await reconcileExamStatuses(targetExamId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to reconcile exam statuses." },
      { status: 500 }
    );
  }
}
