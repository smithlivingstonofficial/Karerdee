import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Desktop software (.exe) is discontinued; all examinations are conducted via the web platform
  return NextResponse.redirect(new URL("/sitting", req.url));
}
