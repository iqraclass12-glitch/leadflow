import { mutation } from "./_generated/server";
import { v } from "convex/values";

function hashPassword(password: string) {
  let hash = 2166136261;
  for (let i = 0; i < password.length; i++) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1:${hash >>> 0}`;
}

export const signUpUser = mutation({
  args: { email: v.string(), password: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) throw new Error("Email already registered");
    const users = await ctx.db.query("users").collect();
    const userId = await ctx.db.insert("users", {
      email,
      passwordHash: hashPassword(args.password),
      isDisabled: false,
    });
    await ctx.db.insert("profiles", {
      id: String(userId),
      email,
      name: args.name.trim() || email.split("@")[0],
      suspended: false,
    });
    await ctx.db.insert("user_roles", {
      user_id: String(userId),
      role: users.length === 0 ? "admin" : "manager",
    });
    return {
      ok: true,
      user: { id: String(userId), email, user_metadata: { name: args.name.trim() } },
    };
  },
});

export const signInUser = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) throw new Error("Invalid credentials");
    if (user.isDisabled) throw new Error("User disabled");
    if (user.passwordHash !== hashPassword(args.password)) throw new Error("Invalid credentials");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_profile_id", (q) => q.eq("id", String(user._id)))
      .first();
    if (profile?.suspended) throw new Error("User suspended");
    return {
      ok: true,
      user: { id: String(user._id), email: user.email, user_metadata: { name: profile?.name } },
    };
  },
});

// Admin disables a user
export const adminDisableUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { isDisabled: true });
    return { ok: true };
  },
});
