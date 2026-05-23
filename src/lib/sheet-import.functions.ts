import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Convert any Google Sheets URL to a CSV export URL
function toCsvUrl(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const id = m[1];
  const gidMatch = input.match(/[?#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export const fetchGoogleSheetCsv = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ url: z.string().url().max(1000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const csvUrl = toCsvUrl(data.url);
    if (!csvUrl) {
      return { ok: false as const, error: "Not a valid Google Sheets URL." };
    }
    try {
      const res = await fetch(csvUrl, { redirect: "follow" });
      if (!res.ok) {
        return {
          ok: false as const,
          error: `Could not fetch sheet (status ${res.status}). Make sure the sheet is shared as "Anyone with the link".`,
        };
      }
      const ct = res.headers.get("content-type") ?? "";
      const csv = await res.text();
      if (ct.includes("text/html") || /<html[\s>]/i.test(csv.slice(0, 500))) {
        return {
          ok: false as const,
          error: 'Google returned a login page. Open the sheet → Share → "Anyone with the link can view", then retry.',
        };
      }
      return { ok: true as const, csv };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Fetch failed" };
    }
  });
