import session from "express-session";
import type { Request, Response, NextFunction, RequestHandler } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const secret = process.env["SESSION_SECRET"] ?? "dev-insecure-secret";

export const sessionMiddleware: RequestHandler = session({
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    secure: false,
  },
});

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: "super_master" | "master" | "admin" | "client_admin" | "operator";
  companyId: number | null;
  isActive: boolean;
  enabledModules: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(...roles: AuthUser["role"][]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireModule(moduleName: string): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    // Master/Super Master roles have full access to all modules
    if (req.user.role === "master" || req.user.role === "super_master") {
      next();
      return;
    }
    
    const modules = (req.user.enabledModules || "").split(",");
    if (!modules.includes(moduleName)) {
      res.status(403).json({ error: `Forbidden: '${moduleName}' module is disabled for your account` });
      return;
    }
    next();
  };
}

