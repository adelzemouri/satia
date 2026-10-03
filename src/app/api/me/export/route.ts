import { headers } from "next/headers";

import { auth } from "@/server/auth";
import { collectUserData, toCsvZip } from "@/server/data-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const data = await collectUserData(session.user.id);
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = data.exportedAt.slice(0, 10);

  if (format === "csv") {
    return new Response(Buffer.from(toCsvZip(data)), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="pommelia-export-${stamp}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pommelia-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
