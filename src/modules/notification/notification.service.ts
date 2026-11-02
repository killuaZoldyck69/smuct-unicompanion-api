import { prisma } from "../../lib/prisma";

export type NotificationPayload = {
  type: string;
  title: string;
  body: string;
  route: string;
  dedupeKey: string;
};

export type RecipientNotification = NotificationPayload & { userId: string };
type CourseHubContext = { courseCode: string; courseName: string };

const withCourseHubContext = <T extends { title: string; body: string }>(
  notification: T,
  course: CourseHubContext | null,
): T => {
  if (!course) return notification;

  const courseCode = course.courseCode.trim();
  const courseName = course.courseName.trim();
  const courseLabel = [courseCode, courseName].filter(Boolean).join(" - ");
  if (!courseLabel) return notification;

  return {
    ...notification,
    title:
      courseCode && !notification.title.includes(courseCode)
        ? `${notification.title} (${courseCode})`
        : notification.title,
    body: notification.body.startsWith(courseLabel)
      ? notification.body
      : `${courseLabel}: ${notification.body}`,
  } as T;
};

const findCourseHubContext = (hubId: string) =>
  prisma.courseHub.findUnique({
    where: { id: hubId },
    select: { courseCode: true, courseName: true },
  });

export const createNotificationsForRecipients = async (
  notifications: RecipientNotification[],
) => {
  const notificationsByRecipientAndKey = new Map<string, RecipientNotification>();
  for (const notification of notifications) {
    if (!notification.userId) continue;
    notificationsByRecipientAndKey.set(
      `${notification.userId}:${notification.dedupeKey}`,
      notification,
    );
  }
  const uniqueNotifications = [...notificationsByRecipientAndKey.values()];
  if (!uniqueNotifications.length) return;

  try {
    await prisma.notification.createMany({
      data: uniqueNotifications,
      skipDuplicates: true,
    });
  } catch (error) {
    // Notifications must not turn a successful feature action into an API error.
    console.error(
      JSON.stringify({
        level: "error",
        event: "notifications.create_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  }
};

export const createNotifications = async (
  userIds: string[],
  payload: NotificationPayload,
) =>
  createNotificationsForRecipients(
    userIds.map((userId) => ({ userId, ...payload })),
  );

export const createCourseNotificationsForRecipients = async (
  hubId: string,
  notifications: RecipientNotification[],
) => {
  try {
    const course = await findCourseHubContext(hubId);
    await createNotificationsForRecipients(
      notifications.map((notification) =>
        withCourseHubContext(notification, course),
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "notifications.course_context_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    await createNotificationsForRecipients(notifications);
  }
};

export const createHubNotifications = async (
  hubId: string,
  actorId: string,
  payload: Omit<NotificationPayload, "dedupeKey"> & { dedupeKey: string },
) => {
  try {
    const [members, course] = await Promise.all([
      prisma.hubMember.findMany({
        where: { hubId, isActive: true, userId: { not: actorId } },
        select: { userId: true },
      }),
      findCourseHubContext(hubId).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            level: "error",
            event: "notifications.course_context_failed",
            errorType: error instanceof Error ? error.name : "UnknownError",
          }),
        );
        return null;
      }),
    ]);
    await createNotificationsForRecipients(
      members.map((member) =>
        withCourseHubContext({ ...payload, userId: member.userId }, course),
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "notifications.hub_recipients_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  }
};

const attachCourseHubContext = async <
  T extends { type: string; route: string; title: string; body: string },
>(notifications: T[]) => {
  const hubNotificationTypes = new Set([
    "HUB_ANNOUNCEMENT",
    "CLASS_NOTICE",
    "ASSESSMENT",
    "GRADE",
  ]);
  const hubIds = [
    ...new Set(
      notifications
        .filter((notification) => hubNotificationTypes.has(notification.type))
        .map((notification) => notification.route.match(/^\/hub\/([^/?#]+)/)?.[1])
        .filter((hubId): hubId is string => Boolean(hubId)),
    ),
  ];
  if (!hubIds.length) return notifications;

  try {
    const hubs = await prisma.courseHub.findMany({
      where: { id: { in: hubIds } },
      select: { id: true, courseCode: true, courseName: true },
    });
    const hubsById = new Map<string, CourseHubContext>();
    for (const hub of hubs) {
      hubsById.set(hub.id, hub);
    }

    return notifications.map((notification) => {
      const hubId = notification.route.match(/^\/hub\/([^/?#]+)/)?.[1];
      return hubId
        ? withCourseHubContext(notification, hubsById.get(hubId) ?? null)
        : notification;
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "notifications.course_context_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return notifications;
  }
};

export const getNotifications = async (
  userId: string,
  page = 1,
  limit = 30,
) => {
  const skip = (page - 1) * limit;
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const itemsWithCourseContext = await attachCourseHubContext(items);

  return {
    items: itemsWithCourseContext,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + items.length < total,
    },
    unreadCount,
  };
};

export const getUnreadNotificationCount = (userId: string) =>
  prisma.notification.count({ where: { userId, readAt: null } });

export const markNotificationRead = async (userId: string, id: string) => {
  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (!result.count) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!notification) return null;
  }
  return prisma.notification.findFirst({ where: { id, userId } });
};

export const markAllNotificationsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
};
