import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { studentRoutes } from "./modules/student/student.routes";

const app: Application = express();

app.use(
  cors({
    origin: ["*", "http://192.168.0.102:8081", "http://192.168.0.100"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all("/api/auth/{*any}", toNodeHandler(auth));

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "SMUCT Unicompanion Engine is online",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/students", studentRoutes);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🔥 Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;
