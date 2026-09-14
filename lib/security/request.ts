import { NextRequest } from "next/server";
import { sameOriginWriteFromParts } from "@/lib/security/origin";

export function sameOriginWrite(req: NextRequest): boolean {
  return sameOriginWriteFromParts(req.method, req.headers, req.url);
}
