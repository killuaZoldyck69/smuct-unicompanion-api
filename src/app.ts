import express, { Application, Request, Response } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { studentRoutes } from "./modules/student/student.routes";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { teacherRoutes } from "./modules/teacher/teacher.routes";
import { calendarRoutes } from "./modules/calendar/calendar.routes";
import { busRoutes } from "./modules/bus/bus.routes";
import { noticeRoutes } from "./modules/notice/notice.routes";
import { eventRoutes } from "./modules/event/event.routes";
import { userRoutes } from "./modules/user/user.routes";
import { forumRoutes } from "./modules/forum/forum.routes";

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
    message: "SMUCT UniCompanion Engine is online",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/calendars", calendarRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/forum", forumRoutes);

app.use(globalErrorHandler);

export default app;
