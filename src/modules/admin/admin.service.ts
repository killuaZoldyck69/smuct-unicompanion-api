import { prisma } from "../../lib/prisma";

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
    recentActivity: activities.slice(0, 10),
  };
};
