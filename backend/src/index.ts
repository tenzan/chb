import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import type { Env } from "./types/env";
import { bootstrapAdmin } from "./lib/bootstrap";
import auth from "./routes/auth";
import adminUsers from "./routes/admin-users";
import adminInvites from "./routes/admin-invites";
import adminParents from "./routes/admin-parents";
import adminStudents from "./routes/admin-students";

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", secureHeaders());
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Bootstrap admin on first request
let bootstrapped = false;
app.use("*", async (c, next) => {
  if (!bootstrapped) {
    await bootstrapAdmin(c.env.DB, c.env);
    bootstrapped = true;
  }
  await next();
});

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/auth", auth);
app.route("/api/admin/users", adminUsers);
app.route("/api/admin/invites", adminInvites);
app.route("/api/admin/parents", adminParents);
app.route("/api/admin/students", adminStudents);

export default app;
