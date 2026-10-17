import { AppError } from "../../utils/AppError";
import * as userRepository from "./user.repository";
import { UpdateRolePayload, GetUsersQuery } from "./user.schema";
import {
  uploadSingleImageService,
  MulterFile,
  MAX_PROFILE_IMAGE_SIZE,
} from "../upload/upload.service";
import { deleteImageFromCloudinary } from "../../lib/cloudinary";
import { appCache } from "../../lib/cache";

const DEPARTMENT_ALIASES: Record<string, string[]> = {
  CSE: ["computer science and engineering", "cse", "computer science"],
  CSIT: ["computer science and information technology", "csit", "information technology"],
  AMMT: ["apparel manufacturing management and technology", "ammt", "apparel"],
  FDT: ["fashion design and technology", "fdt", "fashion design"],
  IA: ["interior architecture", "ia", "interior design"],
  GDM: ["graphic design and multimedia", "gdm", "graphic design"],
  ARCH: ["architecture", "arch"],
  BBA: ["business administration", "bba", "business"],
  ENG: ["english", "eng"],
  LAW: ["law", "llb", "llm"],
  SOC: ["sociology & anthropology", "sociology", "anthropology", "soc"],
  BAN: ["bangla", "ban"],
  "G&P": ["government & politics", "government and politics", "g&p", "gp"],
  IS: ["islamic studies", "is"],
  FA: ["fine arts", "fine art", "fa"],
  MUS: ["music", "mus"],
  DAN: ["dance", "dan"],
};

export const getAllUsersService = async (query?: GetUsersQuery) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query?.limit) || 20));
  const skip = (page - 1) * limit;

  const role = query?.role;
  const department = query?.department;
  const tag = query?.tag;
  const search = query?.search?.trim() || "";

  // Deterministic cache key for in-memory caching
  const cacheKey = `users:list:${role || "ALL"}:${department || "ALL"}:${tag || "ALL"}:${search}:${page}:${limit}`;

  return await appCache.getOrSet(
    cacheKey,
    async () => {
      const conditions: any[] = [];

      // 1. Filter by Role (STUDENT | TEACHER | ADMIN)
      if (role) {
        conditions.push({ role });
      }

      // 2. Filter by Department (Short Code or Full Name with Aliases)
      if (department && department !== "All") {
        const deptKey = department.trim().toUpperCase();
        const aliases = DEPARTMENT_ALIASES[deptKey] || [department.trim().toLowerCase()];

        if (role === "STUDENT") {
          conditions.push({
            studentProfile: {
              OR: aliases.map((alias) => ({
                department: { contains: alias, mode: "insensitive" },
              })),
            },
          });
        } else if (role === "TEACHER") {
          conditions.push({
            teacherProfile: {
              OR: aliases.map((alias) => ({
                department: { contains: alias, mode: "insensitive" },
              })),
            },
          });
        } else {
          conditions.push({
            OR: [
              {
                studentProfile: {
                  OR: aliases.map((alias) => ({
                    department: { contains: alias, mode: "insensitive" },
                  })),
                },
              },
              {
                teacherProfile: {
                  OR: aliases.map((alias) => ({
                    department: { contains: alias, mode: "insensitive" },
                  })),
                },
              },
            ],
          });
        }
      }

      // 3. Filter by Student Role Tags (CR / TA)
      if (role === "STUDENT" && tag && tag !== "ALL") {
        if (tag === "CR") {
          conditions.push({ studentProfile: { isCR: true } });
        } else if (tag === "TA") {
          conditions.push({ studentProfile: { isTA: true } });
        }
      }

      // 4. Multi-field Search (name, email, phone, studentId, teacherId, department, designation)
      if (search) {
        conditions.push({
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search, mode: "insensitive" } },
            { studentProfile: { studentId: { contains: search, mode: "insensitive" } } },
            { studentProfile: { department: { contains: search, mode: "insensitive" } } },
            { teacherProfile: { teacherId: { contains: search, mode: "insensitive" } } },
            { teacherProfile: { department: { contains: search, mode: "insensitive" } } },
            { teacherProfile: { designation: { contains: search, mode: "insensitive" } } },
          ],
        });
      }

      const where: any = {};
      if (conditions.length > 0) {
        where.AND = conditions;
      }

      const [users, total] = await Promise.all([
        userRepository.findUsersWithProfiles(where, skip, limit),
        userRepository.countUsers(where),
      ]);

      return {
        data: users,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      };
    },
    60, // 60 seconds TTL cache
  );
};

export const deleteUserService = async (id: string, callerId?: string) => {
  if (callerId && id === callerId) {
    throw new AppError("Administrators cannot delete their own account.", 400);
  }

  const existingUser = await userRepository.findUserById(id);

  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }

  // Cascades automatically to StudentProfile, TeacherProfile, Session, Account, etc.
  const result = await userRepository.deleteUserById(id);

  // Invalidate in-memory user list cache
  appCache.delPattern(/^users:list/);

  // Storage cleanup optimization: delete user profile image from Cloudinary
  if (existingUser.image) {
    deleteImageFromCloudinary(existingUser.image).catch((err) =>
      console.warn("[Cloudinary] Failed to clean up user image:", err)
    );
  }

  return result;
};

export const updateStudentRoleService = async (
  id: string,
  action: UpdateRolePayload["action"],
) => {
  // Verify user exists and retrieve their student profile
  const user = await userRepository.findUserWithStudentProfile(id);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  if (!user.studentProfile) {
    throw new AppError(
      "This action can only be performed on student accounts.",
      400,
    );
  }

  // Determine the boolean flags based on the requested action
  let updateData = {};
  if (action === "MAKE_CR") {
    updateData = { isCR: true };
  } else if (action === "MAKE_TA") {
    updateData = { isTA: true };
  } else if (action === "REMOVE_ROLE") {
    updateData = { isCR: false, isTA: false };
  }

  // Invalidate in-memory user list cache
  appCache.delPattern(/^users:list/);

  // Apply the update to the delegated StudentProfile
  return await userRepository.updateStudentProfileByUserId(id, updateData);
};

export const updateUserProfileImageService = async (
  userId: string,
  file?: MulterFile,
  base64?: string,
  imageUrl?: string,
) => {
  const existingUser = await userRepository.findUserById(userId);
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }
  const previousImage = existingUser.image;

  // Strict profile image size limit (< 3MB)
  if (file && file.size >= MAX_PROFILE_IMAGE_SIZE) {
    throw new AppError("Profile image must be less than 3 MB.", 400);
  }

  if (base64 && base64.trim()) {
    const rawBase64 = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    const approxSizeBytes = Math.ceil((rawBase64.length * 3) / 4);
    if (approxSizeBytes >= MAX_PROFILE_IMAGE_SIZE) {
      throw new AppError("Profile image must be less than 3 MB.", 400);
    }
  }

  let finalImageUrl = imageUrl?.trim();

  if (file || (base64 && base64.trim())) {
    const uploadResult = await uploadSingleImageService(
      file,
      base64,
      "smuct-unicompanion/profiles",
    );
    finalImageUrl = uploadResult.secureUrl;
  }

  if (!finalImageUrl) {
    throw new AppError("No image file, base64 data, or image URL provided.", 400);
  }

  const updatedUser = await userRepository.updateUserImageById(
    userId,
    finalImageUrl,
  );

  if (!updatedUser) {
    throw new AppError("User not found.", 404);
  }

  // Invalidate in-memory user list cache
  appCache.delPattern(/^users:list/);

  // Storage cleanup optimization: delete previous image from Cloudinary
  if (previousImage && previousImage !== finalImageUrl) {
    deleteImageFromCloudinary(previousImage).catch((err) =>
      console.warn("[Cloudinary] Failed to clean up previous profile image:", err)
    );
  }

  return {
    imageUrl: finalImageUrl,
    user: updatedUser,
  };
};

