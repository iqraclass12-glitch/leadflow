import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Function to fetch tasks
export const getTasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});
