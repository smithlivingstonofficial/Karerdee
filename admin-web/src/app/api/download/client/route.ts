import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    // Check multiple candidate locations for dist/SafeExamClient.exe
    const possiblePaths = [
      path.resolve(process.cwd(), "..", "dist", "SafeExamClient.exe"),
      path.resolve(process.cwd(), "dist", "SafeExamClient.exe"),
      path.resolve(process.cwd(), "public", "SafeExamClient.exe"),
    ];

    let binaryPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        binaryPath = p;
        break;
      }
    }

    if (!binaryPath) {
      return NextResponse.json(
        { error: "SafeExamClient binary is not currently available on the server. Please contact the administrator." },
        { status: 404 }
      );
    }

    const stat = fs.statSync(binaryPath);
    const fileStream = fs.createReadStream(binaryPath);

    // Convert node read stream to Web ReadableStream
    const readable = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.microsoft.portable-executable",
        "Content-Disposition": 'attachment; filename="SafeExamClient.exe"',
        "Content-Length": stat.size.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    console.error("Client Download Error:", err);
    return NextResponse.json(
      { error: "Internal server error while serving client binary." },
      { status: 500 }
    );
  }
}

