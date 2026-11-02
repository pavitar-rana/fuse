import crypto from "crypto";
import type { RequestHandler } from "express";
import { prisma } from "@fuse/db";
import { hashApiKey } from "@fuse/db/api-key";
import { env } from "../config/env.ts";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

// Two ways in:
//  1. `Authorization: Bearer fc_...`: a user's API key (SDK / curl).
//  2. `X-Fuse-Internal-Secret` + `X-Fuse-User-Id`: the dashboard's server
//     actions, which already verified the user's session. Only enabled when
//     INTERNAL_API_SECRET is set.
// The user id always comes from here, never from the request body.
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const internal = req.header("x-fuse-internal-secret");
    if (internal !== undefined) {
      const userId = req.header("x-fuse-user-id");
      if (env.internalApiSecret && safeEqual(internal, env.internalApiSecret) && userId) {
        req.userId = userId;
        return next();
      }
      return res.status(401).json({ message: "Invalid internal credentials" });
    }

    const [scheme, key] = (req.header("authorization") ?? "").split(" ");
    if (scheme !== "Bearer" || !key) {
      return res.status(401).json({ message: "Missing API key" });
    }

    const user = await prisma.user.findUnique({
      where: { apiKeyHash: hashApiKey(key) },
      select: { id: true },
    });
    if (!user) return res.status(401).json({ message: "Invalid API key" });

    req.userId = user.id;
    next();
  } catch (err) {
    next(err);
  }
};
