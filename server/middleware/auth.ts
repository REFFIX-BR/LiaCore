import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JWTPayload } from "../lib/auth";
import { storage } from "../storage";

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const payload = verifyToken(token);

  if (!payload) {
    res.clearCookie("auth_token");
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  req.user = payload;
  next();
}

// Middleware to track user activity for status monitoring
export function trackUserActivity(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.user?.userId) {
    // Update activity asynchronously without blocking the request
    storage.updateUserActivity(req.user.userId).catch(err => {
      console.error("Error updating user activity:", err);
    });
  }
  next();
}

// Combined middleware: authenticate + track activity
export function authenticateWithTracking(
  req: Request,
  res: Response,
  next: NextFunction
) {
  authenticate(req, res, () => {
    trackUserActivity(req, res, next);
  });
}

// Type for user roles
type UserRole = "ADMIN" | "SUPERVISOR" | "AGENT";

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    if (req.user.role !== role && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Sem permissão para acessar este recurso" });
    }

    next();
  };
}

export function requireAnyRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ error: "Sem permissão para acessar este recurso" });
    }

    next();
  };
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Apenas administradores podem acessar este recurso" });
  }

  next();
}

// Admin or Supervisor can access (management operations)
export function requireAdminOrSupervisor(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  if (req.user.role !== "ADMIN" && req.user.role !== "SUPERVISOR") {
    return res.status(403).json({ error: "Acesso restrito a supervisores e administradores" });
  }

  next();
}

// Check if user can manage a specific resource (e.g., assigned conversation)
export function canManageResource(userId: string, resourceOwnerId?: string | null): boolean {
  // Admin and Supervisor can manage any resource
  // Agent can only manage their own resources
  return !resourceOwnerId || resourceOwnerId === userId;
}
