import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Users, Clock, CheckCircle2, PhoneCall, ListChecks, Activity } from "lucide-react";
import { STATUSES, statusColor, type LeadStatus } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Counts = {
  total: number;
  pending: number;
  interested: number;
  joined: number;
  myAssigned: number;
  byStatus: Record<LeadStatus, number>;
  todayActivity: number;
};

const EMPTY: Counts = {
  total: 0, pending: 0, interested: 0, joined: 0, myAssigned: 0, todayActivity: 0,
  byStatus: Object.fromEntries(STATUSES.map(s => [s, 0])) as Record<LeadStatus, number>,
};

function Dashboard() {
  const { user, isAdmin, profileName } = useAuth();
  const data = useQuery(
    api.crm.dashboardStats,
    user ? { userId: user.id, isAdmin } : "skip",
  );
  const loading = data === undefined;
  const stats = useMemo<Counts>(() => {
    if (!data) return EMPTY;
    const list = data.leads as { id: string; status: LeadStatus; assigned_to?: string | null }[];
    const byStatus = Object.fromEntries(STATUSES.map(s => [s, 0])) as Record<LeadStatus, number>;
    let myAssigned = 0;
    for (const l of list) {
      if (byStatus[l.status] !== undefined) byStatus[l.status]++;
      if (l.assigned_to === user.id) myAssigned++;
    }
    return {
      total: list.length,
      pending: byStatus["Pending"] ?? 0,
      interested: byStatus["Interested"] ?? 0,
      joined: byStatus["Joined"] ?? 0,
      myAssigned,
      byStatus,
      todayActivity: data.todayActivity,
    };
  }, [data, user?.id]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">SAPE Education Fair</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {profileName ? `Welcome back, ${profileName}.` : "Welcome back."} Live overview of your leads & activity.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Users} label={isAdmin ? "Total leads" : "Visible leads"} value={stats.total} />
        <StatCard icon={ListChecks} label="My assigned" value={stats.myAssigned} />
        <StatCard icon={Clock} label="Pending" value={stats.pending} />
        <StatCard icon={CheckCircle2} label="Interested" value={stats.interested} />
        <StatCard icon={PhoneCall} label="Joined" value={stats.joined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card className="md:col-span-2 p-5">
          <h2 className="font-semibold mb-4">Status breakdown</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : stats.total === 0 ? (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <div className="space-y-2">
              {STATUSES.map((status) => {
                const c = stats.byStatus[status] ?? 0;
                const pct = stats.total ? (c / stats.total) * 100 : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border w-32 justify-center ${statusColor(status)}`}>
                      {status}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground w-12 text-right">{c}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Activity className="size-4" /> Today's activity
          </div>
          <div className="text-4xl font-semibold tabular-nums mt-2">{stats.todayActivity}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {isAdmin ? "All actions logged today by your team." : "Calls, status updates, and notes you logged today."}
          </p>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="size-9 rounded-md flex items-center justify-center mb-3 bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </Card>
  );
}
