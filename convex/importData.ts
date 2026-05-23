import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Example: Import a batch of leads
export const importLeads = mutation({
  args: {
    leads: v.array(
      v.object({
        name: v.string(),
        phone: v.optional(v.string()),
        status: v.string(),
        notes: v.optional(v.string()),
        assigned_to: v.optional(v.string()),
        created_by: v.optional(v.string()),
        created_at: v.string(),
        updated_at: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const lead of args.leads) {
      await ctx.db.insert("leads", lead);
    }
    return { ok: true, count: args.leads.length };
  },
});

// Repeat for other tables as needed (groups, notes, etc.)
