import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
const samples = ["1c30cd728e27ef84f7359e7e29c490d9.jpg", "97c4ac886aa8731e8ccf3e689be6a226.jpg", "17647455511905_20251203502603.jpg", "3e89397075b7d0ba591927278b01678f.jpg", "855fae2f5497d88b019754fa87df4ddb.jpg", "6ca65ef1bcd0cb5f378bb414fe8a74ae.jpg", "a56c763f9b74907001de4b8df9a2b6af.jpg", "1f2d441282f4e0a2ebed26fe61684e4c.jpg", "0def8081cdb96d483a0448b0d0409031.jpg"];
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const raw = request.nextUrl.searchParams.get("index");
  if (!raw || !/^[0-8]$/.test(raw)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(`C:/Users/admin/Downloads/${samples[Number(raw)]}`);
    return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 404 }); }
}
