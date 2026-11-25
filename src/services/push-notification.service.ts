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

type PushTokenWhere = NonNullable<
  Parameters<typeof prisma.pushToken.deleteMany>[0]
>["where"];

export const extractDeadTokensForChunk = (
  chunk: readonly ExpoPushMessage[],
  ticketChunk: readonly ExpoPushTicket[],
): string[] => {
  const dead: string[] = [];
  ticketChunk.forEach((ticket, idx) => {
    if (
      ticket.status === "error" &&
      ticket.details?.error === "DeviceNotRegistered"
    ) {
      const recipientToken = chunk[idx]?.to;
      if (typeof recipientToken === "string") {
        dead.push(recipientToken);
      }
    }
  });
  return dead;
};

async function prunePushTokens(
  where: PushTokenWhere,
  reason: string,
): Promise<void> {
  try {
    await prisma.pushToken.deleteMany({ where });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "push.token_prune_failed",
        reason,
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  }
}

export const sendPushNotifications = (options: SendPushOptions): void => {
  const { userIds, title, body, route, data = {} } = options;
  if (!userIds || !userIds.length) return;

  // Detached dispatch keeps request latency isolated from Expo push network round-trips.
  setImmediate(async () => {
    try {
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

      if (malformedTokenIds.length > 0) {
        await prunePushTokens(
          { id: { in: malformedTokenIds } },
          "malformed_token",
        );
      }

      if (!messages.length) return;

      const chunks = expo.chunkPushNotifications(messages);
      const deadTokens: string[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          deadTokens.push(...extractDeadTokensForChunk(chunk, ticketChunk));
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

      if (deadTokens.length > 0) {
        await prunePushTokens(
          { token: { in: deadTokens } },
          "device_not_registered",
        );
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
