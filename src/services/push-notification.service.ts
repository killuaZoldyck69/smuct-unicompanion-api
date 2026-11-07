import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { prisma } from "../lib/prisma";

const expo = new Expo();

export interface SendPushOptions {
  userIds: string[];
  title: string;
  body: string;
  route: string;
  data?: Record<string, unknown>;
}

/**
 * Dispatches push notifications to target user devices via Expo Push Service.
 * Runs non-blocking (fire-and-forget) to ensure API endpoints return instantly
 * without being held up by external network latency or Expo service response times.
 */
export const sendPushNotifications = (options: SendPushOptions): void => {
  const { userIds, title, body, route, data = {} } = options;
  if (!userIds || !userIds.length) return;

  setImmediate(async () => {
    try {
      // 1. Fetch tokens for all target recipients in a single indexed query
      const tokenRecords = await prisma.pushToken.findMany({
        where: { userId: { in: userIds } },
        select: { id: true, token: true },
      });

      if (!tokenRecords.length) return;

      const messages: ExpoPushMessage[] = [];
      const malformedTokenIds: string[] = [];

      for (const record of tokenRecords) {
        if (!Expo.isExpoPushToken(record.token)) {
          malformedTokenIds.push(record.id);
          continue;
        }

        messages.push({
          to: record.token,
          sound: "default",
          title,
          body,
          data: { ...data, route },
          channelId: "default",
          priority: "high",
        });
      }

      // Cleanup any locally detected malformed tokens immediately
      if (malformedTokenIds.length > 0) {
        await prisma.pushToken.deleteMany({
          where: { id: { in: malformedTokenIds } },
        }).catch(() => {});
      }

      if (!messages.length) return;

      // 2. Chunk into batches of up to 100 as required by Expo
      const chunks = expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error(
            JSON.stringify({
              level: "error",
              event: "push.chunk_send_failed",
              chunkSize: chunk.length,
              errorType: error instanceof Error ? error.name : "UnknownError",
              errorMessage: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      // 3. Inspect tickets for DeviceNotRegistered (uninstalled or expired) and prune them
      const deadTokens: string[] = [];
      tickets.forEach((ticket, idx) => {
        if (
          ticket.status === "error" &&
          ticket.details?.error === "DeviceNotRegistered"
        ) {
          const recipientToken = messages[idx]?.to;
          if (typeof recipientToken === "string") {
            deadTokens.push(recipientToken);
          }
        }
      });

      if (deadTokens.length > 0) {
        await prisma.pushToken.deleteMany({
          where: { token: { in: deadTokens } },
        }).catch(() => {});
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "push.dispatch_unhandled_failure",
          errorType: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });
};
