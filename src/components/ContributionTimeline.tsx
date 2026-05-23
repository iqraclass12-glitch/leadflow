import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDistanceToNow } from "date-fns";
import type { Contribution } from "@/lib/leads";
import { contributionLabel, contributionTone } from "@/lib/leads";

interface Props { leadId: string }
type Profile = { id: string; name: string | null; email: string | null };

export function ContributionTimeline({ leadId }: Props) {
  const items = (useQuery(api.crm.listContributions, { leadId }) as Contribution[] | undefined) ?? [];
  const profilesList = useQuery(api.crm.listProfiles) as Profile[] | undefined;
  const loading = profilesList === undefined;
  const profiles = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of profilesList ?? []) map[p.id] = p;
    return map;
  }, [profilesList]);

  const name = (id: string) => profiles[id]?.name || profiles[id]?.email?.split("@")[0] || "Manager";

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (items.length === 0) return <p className="text-xs text-muted-foreground">No activity yet.</p>;

  return (
    <ol className="relative border-l border-border ml-2 space-y-3 max-h-64 overflow-y-auto pr-1">
      {items.map(c => (
        <li key={c.id} className="ml-4">
          <span className={`absolute -left-1.5 mt-1.5 size-3 rounded-full ring-2 ring-background ${contributionTone(c.contribution_type)}`} />
          <div className="text-sm">
            <span className="font-medium">{name(c.manager_id)}</span>{" "}
            <span className="text-muted-foreground">{contributionLabel(c.contribution_type)}</span>
          </div>
          {c.description && c.contribution_type !== "lead_created" && (
            <div className="text-xs text-foreground/80 mt-0.5">{c.description}</div>
          )}
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
          </div>
        </li>
      ))}
    </ol>
  );
}
