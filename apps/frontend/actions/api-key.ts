"use server";

import { prisma } from "@fuse/db";
import { generateApiKey } from "@fuse/db/api-key";
import { auth } from "@/auth";

// Issues a new key and invalidates the previous one. The plaintext is
// returned exactly once; only its hash is stored.
export const rotateApiKey = async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return { ok: false as const, message: "Not signed in" };

  const { key, hash, prefix } = generateApiKey();
  await prisma.user.update({
    where: { id },
    data: { apiKeyHash: hash, apiKeyPrefix: prefix },
  });
  return { ok: true as const, key };
};
