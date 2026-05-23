import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  Mail,
  ShieldCheck,
  History,
  Upload,
  Database,
  Users,
  LogOut,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { contributionLabel, type Contribution } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type Stats = { calls: number; notes: number; statusUpdates: number; leadsCreated: number };

function ProfilePage() {
  const { user, role, profileName, isAdmin, signOut, refreshRole } = useAuth();
  const [stats, setStats] = useState<Stats>({
    calls: 0,
    notes: 0,
    statusUpdates: 0,
    leadsCreated: 0,
  });
  const recent =
    (useQuery(api.crm.listContributions, user ? { managerId: user.id, limit: 20 } : "skip") as
      | Contribution[]
      | undefined) ?? [];
  const calls =
    (useQuery(
      api.crm.listActivity,
      user ? { userId: user.id, action: "call", limit: 10000 } : "skip",
    ) as { id: string }[] | undefined) ?? [];
  const callCount = calls.length;
  const loading = !user || recent === undefined;

  useEffect(() => {
    refreshRole();
  }, []);

  useEffect(() => {
    if (!user) return;
    const s: Stats = { calls: callCount, notes: 0, statusUpdates: 0, leadsCreated: 0 };
    for (const c of recent) {
      if (c.contribution_type === "note_added") s.notes++;
      else if (c.contribution_type === "status_updated") s.statusUpdates++;
      else if (c.contribution_type === "lead_created" || c.contribution_type === "import_added")
        s.leadsCreated++;
    }
    setStats(s);
  }, [user, recent, callCount]);

  if (!user) return null;

  const initials = (profileName || user.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header card */}
      <Card className="p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="size-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold truncate">{profileName ?? user.email}</h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full capitalize ${isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              {isAdmin && <ShieldCheck className="size-3 inline mr-1" />}
              {role ?? "member"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Mail className="size-3.5" /> {user.email}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshRole()}>
            <RefreshCw className="size-4 mr-1" /> Refresh role
          </Button>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="size-4 mr-1" /> Sign out
          </Button>
        </div>
      </Card>

      {/* Admin-only feature panel */}
      {isAdmin && (
        <div>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
            <ShieldCheck className="size-4" /> Admin features
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FeatureLink
              to="/admin"
              icon={<ShieldCheck className="size-5 text-primary" />}
              title="Admin Dashboard"
              desc="Manage users, groups & activity"
            />
            <FeatureLink
              to="/import"
              icon={<Upload className="size-5 text-primary" />}
              title="Upload Leads"
              desc="Import leads via CSV into a group"
            />
            <FeatureLink
              to="/leads"
              icon={<Database className="size-5 text-primary" />}
              title="All Leads"
              desc="View & assign every lead"
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div>
        <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
          Your activity
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Calls made" value={stats.calls} />
          <Stat label="Notes added" value={stats.notes} />
          <Stat label="Status updates" value={stats.statusUpdates} />
          <Stat label="Leads created" value={stats.leadsCreated} />
        </div>
      </div>

      {/* Recent history */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">Recent history</h3>
          </div>
          <Link to="/history" className="text-xs text-primary hover:underline">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No activity yet.</div>
        ) : (
          <ul className="divide-y">
            {recent.map((c) => (
              <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{contributionLabel(c.contribution_type)}</div>
                  {c.description && (
                    <div className="text-xs text-muted-foreground truncate">{c.description}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(c.created_at), "MMM d, HH:mm")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground text-center">
          You have <span className="font-medium">{callCount}</span> calls and {recent.length} recent
          actions on record.
        </p>
      )}
    </div>
  );
}

function FeatureLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to} className="block">
      <Card className="p-4 hover:border-primary/40 transition h-full">
        <div className="mb-2">{icon}</div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}
