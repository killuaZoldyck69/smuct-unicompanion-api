import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { appCache } from "../../lib/cache";
import { SMUCT_PROGRAM_CATALOG } from "../../constants/smuct-catalog";
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
  totalCourseHubs: number;
  recentActivity: ActivityItem[];
}

export interface RawAdminStatsInput {
  userStats: Array<{
    role: string | null;
    isRestricted: boolean;
    _count: { _all: number };
  }>;
  totalCourseHubs: number;
  recentUsers: Array<{
    id: string;
    name: string;
    role: string | null;
    createdAt: Date;
  }>;
  recentRestricted: Array<{
    id: string;
    name: string;
    updatedAt: Date;
  }>;
  recentNotices: Array<{
    id: string;
    title: string;
    issuerName: string;
    createdAt: Date;
  }>;
  recentComplaints: Array<{
    id: string;
    title: string;
    category: string;
    createdAt: Date;
  }>;
}

/**
 * Pure aggregator transforming grouped user counts and recent activity slices
 * into the AdminDashboardStats API response shape without unnecessary PII.
 */
export const aggregateAdminDashboardStats = (
  input: RawAdminStatsInput,
): AdminDashboardStats => {
  let totalStudents = 0;
  let totalTeachers = 0;
  let totalUsers = 0;
  let restrictedUsers = 0;

  for (const bucket of input.userStats) {
    const count = bucket._count._all;
    totalUsers += count;
    if (bucket.role === "STUDENT") totalStudents += count;
    else if (bucket.role === "TEACHER") totalTeachers += count;
    if (bucket.isRestricted) restrictedUsers += count;
  }

  const activities: ActivityItem[] = [];

  for (const u of input.recentUsers) {
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

  for (const r of input.recentRestricted) {
    activities.push({
      id: `restricted-${r.id}`,
      type: "USER_RESTRICTED",
      title: "Account Restricted",
      subtitle: `${r.name}'s account was restricted`,
      timestamp: r.updatedAt.toISOString(),
    });
  }

  for (const n of input.recentNotices) {
    activities.push({
      id: `notice-${n.id}`,
      type: "NOTICE_POSTED",
      title: `Notice: ${n.title}`,
      subtitle: `Issued by ${n.issuerName}`,
      timestamp: n.createdAt.toISOString(),
    });
  }

  for (const c of input.recentComplaints) {
    activities.push({
      id: `complaint-${c.id}`,
      type: "COMPLAINT_FILED",
      title: `Complaint: ${c.title}`,
      subtitle: `Category: ${c.category}`,
      timestamp: c.createdAt.toISOString(),
    });
  }

  activities.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return {
    totalStudents,
    totalTeachers,
    totalUsers,
    restrictedUsers,
    totalCourseHubs: input.totalCourseHubs,
    recentActivity: activities.slice(0, 10),
  };
};

export const getAdminDashboardStatsService = async (): Promise<AdminDashboardStats> => {
  return await appCache.getOrSet(
    "admin:dashboard-stats",
    async () => {
      // Consolidate User counts into one groupBy query and fetch recent activity in parallel
      const [
        userStats,
        totalCourseHubs,
        recentUsers,
        recentRestricted,
        recentNotices,
        recentComplaints,
      ] = await Promise.all([
        prisma.user.groupBy({
          by: ["role", "isRestricted"],
          _count: { _all: true },
        }),
        prisma.courseHub.count(),
        // 5 most recent registered users
        prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, role: true, createdAt: true },
        }),
        // 5 most recent restricted users
        prisma.user.findMany({
          where: { isRestricted: true },
          take: 5,
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, updatedAt: true },
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

      return aggregateAdminDashboardStats({
        userStats,
        totalCourseHubs,
        recentUsers,
        recentRestricted,
        recentNotices,
        recentComplaints,
      });
    },
    20,
  );
};

export const buildAdminCourseHubsWhere = (
  query: AdminCourseHubsQuery,
): Prisma.CourseHubWhereInput => {
  const andConditions: Prisma.CourseHubWhereInput[] = [];

  if (query.status === "ACTIVE") {
    andConditions.push({ isArchived: false });
  } else if (query.status === "ARCHIVED") {
    andConditions.push({ isArchived: true });
  }

  const rawDepartment = query.department?.trim();
  if (rawDepartment && rawDepartment.toUpperCase() !== "ALL") {
    const normalized = rawDepartment.toLowerCase();
    const matchedCatalog = SMUCT_PROGRAM_CATALOG.find(
      (entry) =>
        entry.deptCode.toLowerCase() === normalized ||
        entry.deptFull.toLowerCase() === normalized ||
        entry.deptAliases?.some((alias) => alias.toLowerCase() === normalized),
    );

    if (matchedCatalog) {
      const tokens = [
        matchedCatalog.deptCode,
        matchedCatalog.deptFull,
        ...(matchedCatalog.deptAliases ?? []),
      ];
      andConditions.push({
        OR: tokens.map((token) => ({
          department: { contains: token, mode: "insensitive" },
        })),
      });
    } else {
      andConditions.push({
        department: { contains: rawDepartment, mode: "insensitive" },
      });
    }
  }

  const searchTerm = query.search?.trim();
  if (searchTerm) {
    andConditions.push({
      OR: [
        { courseName: { contains: searchTerm, mode: "insensitive" } },
        { courseCode: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  return andConditions.length > 0 ? { AND: andConditions } : {};
};

export const getAdminCourseHubsService = async (
  query: AdminCourseHubsQuery,
) => {
  const page = query.page || 1;
  const limit = query.limit || 15;
  const skip = (page - 1) * limit;
  const where = buildAdminCourseHubsWhere(query);
  const searchTerm = query.search?.trim() || "";

  const fetchAdminCourseHubs = async () => {
    const now = new Date();
    const [total, hubs, totalActive, totalArchived, departmentsList] =
      await Promise.all([
        prisma.courseHub.count({ where }),
        prisma.courseHub.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ isArchived: "asc" }, { createdAt: "desc" }],
          select: {
            id: true,
            courseCode: true,
            courseName: true,
            semesterNumber: true,
            section: true,
            department: true,
            batch: true,
            termOffer: true,
            isArchived: true,
            isClassLive: true,
            createdAt: true,
            _count: {
              select: {
                members: { where: { isActive: true } },
                assessments: true,
                resources: true,
              },
            },
            members: {
              where: { role: "TEACHER", isActive: true },
              select: {
                id: true,
                role: true,
                user: {
                  select: { id: true, name: true, image: true },
                },
              },
              take: 1,
            },
            assessments: {
              where: { deadline: { gt: now } },
              orderBy: { deadline: "asc" },
              take: 1,
              select: { id: true, title: true, type: true, deadline: true },
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
        role: "ADMIN" as const,
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
  };

  if (searchTerm) {
    return fetchAdminCourseHubs();
  }

  const cacheKey = `admin:course-hubs:p=${page}:l=${limit}:s=${query.status}:d=${query.department || "ALL"}`;
  return appCache.getOrSet(cacheKey, fetchAdminCourseHubs, 45);
};
