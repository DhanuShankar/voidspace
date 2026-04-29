import { Router } from "express";
import authRoutes from "./auth.js";
import fileRoutes from "./files.js";
import workspaceRoutes from "./workspaces.js";
import sessionRoutes from "./sessions.js";
import gatewayRoutes from "./gateway.js";
import aiRoutes from "./ai.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/files", fileRoutes);
router.use("/workspaces", workspaceRoutes);
router.use("/sessions", sessionRoutes);
router.use("/gateways", gatewayRoutes);
router.use("/ai", aiRoutes);

export default router;
