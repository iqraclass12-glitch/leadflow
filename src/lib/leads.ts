export const STATUSES = [
  "Pending",
  "Calling",
  "Interested",
  "Callback",
  "Not Interested",
  "Wrong Number",
  "Joined",
  "Not Picking Up",
  "Switch Off",
] as const;

export type LeadStatus = (typeof STATUSES)[number];

export const QUICK_NOTES = [
  "Interested",
  "Need Callback",
  "Wrong Number",
  "Already Joined",
  "Call Later",
  "Not Picking Up",
  "Phone Switch Off",
];

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  status: LeadStatus;
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ContributionType =
  | "lead_created"
  | "note_added"
  | "status_updated"
  | "assignment_changed"
  | "import_added";

export interface Contribution {
  id: string;
  lead_id: string;
  manager_id: string;
  contribution_type: ContributionType;
  description: string | null;
  created_at: string;
}

export function contributionLabel(t: string): string {
  switch (t) {
    case "lead_created":
      return "created this lead";
    case "note_added":
      return "added a note";
    case "status_updated":
      return "updated status";
    case "assignment_changed":
      return "changed assignment";
    case "import_added":
      return "imported this lead";
    default:
      return t;
  }
}

export function contributionTone(t: string): string {
  switch (t) {
    case "lead_created":
      return "bg-emerald-500";
    case "note_added":
      return "bg-blue-500";
    case "status_updated":
      return "bg-amber-500";
    case "assignment_changed":
      return "bg-pink-500";
    case "import_added":
      return "bg-slate-500";
    default:
      return "bg-muted-foreground";
  }
}

export function statusColor(s: string): string {
  switch (s) {
    case "Pending":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "Calling":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Interested":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Callback":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "Not Interested":
      return "bg-zinc-100 text-zinc-600 border-zinc-200";
    case "Wrong Number":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "Joined":
      return "bg-green-600 text-white border-green-700";
    case "Not Picking Up":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "Switch Off":
      return "bg-zinc-700 text-zinc-100 border-zinc-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function normalizePhone(p: string | null | undefined): string {
  return (p ?? "").toString().replace(/\D+/g, "");
}

/**
 * Build a wa.me URL that opens WhatsApp with a prefilled message.
 * The image URL is NOT appended — admin uploads it as a reference asset only.
 */
export function buildWhatsAppUrl(opts: {
  phone: string | null | undefined;
  message: string;
}): string | null {
  const digits = normalizePhone(opts.phone);
  if (!digits) return null;
  const text = opts.message?.trim() ? encodeURIComponent(opts.message.trim()) : "";
  return `https://wa.me/${digits}${text ? `?text=${text}` : ""}`;
}
