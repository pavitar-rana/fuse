import express from "express";
import { execRoute, vmRoute } from "./routes/index.ts";
import cors from "cors";

const app = express();

app.use(express.json());

app.use(cors());
app.use("/firecracker", vmRoute);
app.use("/firecracker/exec", execRoute);

app.listen(4000, "127.0.0.1", () => {
  console.log("Server running on port : 4000");
});
