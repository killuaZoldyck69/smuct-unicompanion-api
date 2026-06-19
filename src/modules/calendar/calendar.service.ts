import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { CreateCalendarPayload } from "./calendar.schema";

export const createCalendarService = async (data: CreateCalendarPayload) => {
  // Uses a Prisma nested write to ensure the parent calendar and all events
  // are created successfully in a single, secure database transaction.
  return await prisma.academicCalendar.create({
    data: {
      title: data.title,
      semester: data.semester,
      isActive: data.isActive,
      isGlobal: data.isGlobal,
      targetFaculties: data.targetFaculties,
      targetDepartments: data.targetDepartments,
      events: {
        create: data.events.map((event) => ({
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          isHoliday: event.isHoliday,
        })),
      },
    },
    include: {
      events: true, // Return the successfully created nested events
    },
  });
};

export const getRelevantCalendarsService = async (userId: string) => {
  // 1. Fetch the user's profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: true,
      teacherProfile: true,
    },
  });

  if (!user) {
    throw new AppError("User account not found.", 404);
  }

  // 2. ADMIN OVERRIDE: Admins see everything automatically
  if (user.role === "ADMIN") {
    return await prisma.academicCalendar.findMany({
      where: { isActive: true },
      include: {
        events: {
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // 3. Normal User Filtering
  let userFaculty: string | null = null;
  let userDepartment: string | null = null;

  if (user.studentProfile) {
    userFaculty = user.studentProfile.faculty || null;
    userDepartment = user.studentProfile.department;
  } else if (user.teacherProfile) {
    userFaculty = user.teacherProfile.faculty || null;
    userDepartment = user.teacherProfile.department;
  }

  const orConditions: any[] = [{ isGlobal: true }];

  if (userFaculty) {
    // Check for both the exact casing and UPPERCASE to prevent data mismatches
    orConditions.push({ targetFaculties: { has: userFaculty } });
    orConditions.push({ targetFaculties: { has: userFaculty.toUpperCase() } });
  }

  if (userDepartment) {
    orConditions.push({ targetDepartments: { has: userDepartment } });
  }

  // 4. Execute Query
  return await prisma.academicCalendar.findMany({
    where: {
      isActive: true,
      OR: orConditions,
    },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};
