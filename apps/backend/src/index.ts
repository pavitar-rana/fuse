import express from "express";
import cors from "cors";
import { execRoute, vmRoute } from "./routes/index.ts";
import { requireAuth } from "./middleware/auth.ts";
import { errorHandler } from "./middleware/error.ts";
import { startReaper } from "./services/reaper.ts";
import { reconcileOnStartup } from "./services/reconcile.ts";

const app = express();

app.use(express.json({ limit: "20mb" }));
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/firecracker", requireAuth);
app.use("/firecracker/exec", execRoute);
app.use("/firecracker", vmRoute);

app.use(errorHandler);

app.listen(4000, "127.0.0.1", () => {
  console.log("Server running on port : 4000");
  // Fix up VMs left mid-operation before the reaper starts acting on them.
  reconcileOnStartup()
    .catch((err) => console.error("Startup reconcile failed:", err))
    .finally(startReaper);
});
