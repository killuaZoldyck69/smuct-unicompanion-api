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
import { bloodRoutes } from "./modules/blood/blood.routes";
import { directoryRoutes } from "./modules/directory/directory.routes";
import { complaintRoutes } from "./modules/complaint/complaint.routes";
import { alumniRoutes } from "./modules/alumni/alumni.routes";
import { fieldRoutes } from "./modules/field/field.routes";
import { hubRoutes } from "./modules/hub/hub.routes";
import { contentRoutes } from "./modules/hub/content/content.routes";
import { assessmentRoutes } from "./modules/hub/assessments/assessments.routes";
import { reviewRoutes } from "./modules/hub/reviews/reviews.routes";

const app: Application = express();

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      return callback(null, true);
    },
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
app.use("/api/blood", bloodRoutes);
app.use("/api/directory", directoryRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/alumni", alumniRoutes);
app.use("/api/field", fieldRoutes);

// 2. MOUNT THE HUB ROUTES
app.use("/api/hubs", hubRoutes); // Mounts base hub routes to /api/hubs
app.use("/api", contentRoutes); // Mounts nested routes like /api/hubs/:id/discussions
app.use("/api", assessmentRoutes);
app.use("/api", reviewRoutes);

// Global Error Handler
app.use(globalErrorHandler);

export default app;
