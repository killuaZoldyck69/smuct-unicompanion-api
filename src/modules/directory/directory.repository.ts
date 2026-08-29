import { prisma } from "../../lib/prisma";

export const findTeachersDirectory = async () => {
  return await prisma.user.findMany({
    where: {
      role: "TEACHER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phoneNumber: true,
      teacherProfile: true,
    },
    orderBy: {
      name: "asc",
    },
  });
};
