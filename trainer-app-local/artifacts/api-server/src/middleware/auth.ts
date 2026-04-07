import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;
  if (!session?.trainerId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  (req as any).trainerId = session.trainerId;
  next();
}
