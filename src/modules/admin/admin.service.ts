import { prisma } from "../../lib/prisma";
import { appCache } from "../../lib/cache";
import { AdminCourseHubsQuery } from "./admin.schema";

export interface ActivityItem {
  id: string;
  type:
    | "USER_JOINED"
    | "USER_RESTRICTED"
    | "TEACHER_ADDED"
    | "NOTICE_POSTED"
    | "COMPLAINT_FILED"
    | "MAINTENANCE_RUN";
  title: string;
  subtitle: string;
  timestamp: string;
}

export interface AdminDashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalUsers: number;
  restrictedUsers: number;
  pendingApprovals: number;
  activeNotices: number;
  totalCourseHubs: number;
  recentActivity: ActivityItem[];
}

export const getAdminDashboardStatsService = async (): Promise<AdminDashboardStats> => {
  // Run aggregate count queries and recent entity fetches in parallel
  const [
    totalStudents,
    totalTeachers,
    totalUsers,
    restrictedUsers,
    pendingApprovals,
    activeNotices,
    totalCourseHubs,
    recentUsers,
    recentRestricted,
    recentNotices,
    recentComplaints,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.user.count(),
    prisma.user.count({ where: { isRestricted: true } }),
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.notice.count(),
    prisma.courseHub.count(),
    // 5 most recent registered users
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    // 5 most recent restricted users
    prisma.user.findMany({
      where: { isRestricted: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, email: true, updatedAt: true },
    }),
    // 5 most recent notices
    prisma.notice.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, issuerName: true, createdAt: true },
    }),
    // 5 most recent complaints
    prisma.complaint.findMany({
      where: { deletedAt: null },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, category: true, createdAt: true },
    }),
  ]);

  const activities: ActivityItem[] = [];

  for (const u of recentUsers) {
    if (u.role === "TEACHER") {
      activities.push({
        id: `teacher-${u.id}`,
        type: "TEACHER_ADDED",
        title: "Faculty Added",
        subtitle: `${u.name} joined as Faculty`,
        timestamp: u.createdAt.toISOString(),
      });
    } else if (u.role === "STUDENT") {
      activities.push({
        id: `user-${u.id}`,
        type: "USER_JOINED",
        title: "New Student Joined",
        subtitle: `${u.name} joined the platform`,
        timestamp: u.createdAt.toISOString(),
      });
    }
  }

  for (const r of recentRestricted) {
    activities.push({
      id: `restricted-${r.id}`,
      type: "USER_RESTRICTED",
      title: "Account Restricted",
      subtitle: `${r.name}'s account was restricted`,
      timestamp: r.updatedAt.toISOString(),
    });
  }

  for (const n of recentNotices) {
    activities.push({
      id: `notice-${n.id}`,
      type: "NOTICE_POSTED",
      title: `Notice: ${n.title}`,
      subtitle: `Issued by ${n.issuerName}`,
      timestamp: n.createdAt.toISOString(),
    });
  }

  for (const c of recentComplaints) {
    activities.push({
      id: `complaint-${c.id}`,
      type: "COMPLAINT_FILED",
      title: `Complaint: ${c.title}`,
      subtitle: `Category: ${c.category}`,
      timestamp: c.createdAt.toISOString(),
    });
  }

  // Sort unified activity list by descending timestamp
  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    totalStudents,
    totalTeachers,
    totalUsers,
    restrictedUsers,
    pendingApprovals,
    activeNotices,
    totalCourseHubs,
    recentActivity: activities.slice(0, 10),
  };
};

export const getAdminCourseHubsService = async (query: AdminCourseHubsQuery) => {
  const page = query.page || 1;
  const limit = query.limit || 15;
  const skip = (page - 1) * limit;

  // Build secure Prisma where filter
  const where: any = {};

  // Status filter (ACTIVE | ARCHIVED | ALL)
  if (query.status === "ACTIVE") {
    where.isArchived = false;
  } else if (query.status === "ARCHIVED") {
    where.isArchived = true;
  }

  // Department filter
  if (
    query.department &&
    query.department.trim() !== "" &&
    query.department.toUpperCase() !== "ALL"
  ) {
    where.department = {
      equals: query.department.trim(),
      mode: "insensitive",
    };
  }

  // Search filter (matches courseName OR courseCode)
  if (query.search && query.search.trim() !== "") {
    const term = query.search.trim();
    where.OR = [
      { courseName: { contains: term, mode: "insensitive" } },
      { courseCode: { contains: term, mode: "insensitive" } },
    ];
  }

  // Cache key incorporating all normalized query params
  const cacheKey = `admin:course-hubs:p=${page}:l=${limit}:s=${query.status}:d=${query.department || "ALL"}:q=${query.search || ""}`;

  return await appCache.getOrSet(
    cacheKey,
    async () => {
      const [total, hubs, totalActive, totalArchived, departmentsList] =
        await Promise.all([
          prisma.courseHub.count({ where }),
          prisma.courseHub.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ isArchived: "asc" }, { createdAt: "desc" }],
            include: {
              _count: {
                select: { members: true, assessments: true, resources: true },
              },
              members: {
                where: { role: "TEACHER" },
                select: {
                  id: true,
                  role: true,
                  user: {
                    select: { id: true, name: true, image: true, email: true },
                  },
                },
                take: 1,
              },
              assessments: {
                where: { deadline: { gt: new Date() } },
                orderBy: { deadline: "asc" },
                take: 1,
                select: { id: true, title: true, type: true, deadline: true },
              },
              classNotices: {
                where: { isActive: true },
                include: {
                  author: {
                    select: { id: true, name: true, image: true, role: true },
                  },
                },
                orderBy: { createdAt: "desc" },
              },
            },
          }),
          prisma.courseHub.count({ where: { isArchived: false } }),
          prisma.courseHub.count({ where: { isArchived: true } }),
          prisma.courseHub.findMany({
            select: { department: true },
            distinct: ["department"],
            orderBy: { department: "asc" },
          }),
        ]);

      const totalPages = Math.ceil(total / limit) || 1;
      const availableDepartments = departmentsList
        .map((d) => d.department)
        .filter((d): d is string => Boolean(d && d.trim()));

      return {
        hubs: hubs.map((hub) => ({
          id: `admin-${hub.id}`,
          role: "ADMIN" as any,
          hub,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
        meta: {
          totalActive,
          totalArchived,
          availableDepartments,
        },
      };
    },
    45,
  );
};
