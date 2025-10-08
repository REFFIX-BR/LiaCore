import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JWTPayload } from "../lib/auth";

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

export function requireRole(role: "ADMIN" | "AGENT") {
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
