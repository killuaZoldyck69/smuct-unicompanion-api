import { prisma } from "../../lib/prisma";

export const getUserDriveCredentials = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleDriveConnected: true,
      googleDriveEmail: true,
      googleDriveName: true,
      googleDriveAvatarUrl: true,
      googleDriveRefreshTokenEnc: true,
    },
  });
};

export const saveUserDriveConnection = async (
  userId: string,
  data: {
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    encryptedRefreshToken: string;
  },
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      googleDriveConnected: true,
      googleDriveEmail: data.email,
      googleDriveName: data.name,
      googleDriveAvatarUrl: data.avatarUrl,
      googleDriveRefreshTokenEnc: data.encryptedRefreshToken,
    },
    select: {
      id: true,
      googleDriveConnected: true,
      googleDriveEmail: true,
      googleDriveName: true,
      googleDriveAvatarUrl: true,
    },
  });
};

export const clearUserDriveConnection = async (userId: string) => {
  await prisma.user.updateMany({
    where: { id: userId },
    data: {
      googleDriveConnected: false,
      googleDriveEmail: null,
      googleDriveName: null,
      googleDriveAvatarUrl: null,
      googleDriveRefreshTokenEnc: null,
    },
  });
};
