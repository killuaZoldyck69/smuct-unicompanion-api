import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { createNotifications } from "../notification/notification.service";
import {
  filterForumNotificationRecipients,
  isForumItemVisibleToViewer,
} from "./forum.domain";
import * as forumRepository from "./forum.repository";
import {
  CreateForumReportPayload,
  CreatePostPayload,
  CreateResponsePayload,
  ReactResponsePayload,
  ResolvePostPayload,
  UpdatePostPayload,
  UpdateResponsePayload,
} from "./forum.schema";
import {
  extractPlainText,
  validateAndSanitizePost,
  validateAndSanitizeResponse,
} from "./forum.sanitizer";

const assertUserAcceptedUgcTerms = async (userId: string) => {
  const user = await forumRepository.findUserUgcTermsStatus(userId);
  if (!user) {
    throw new AppError("User account not found.", 404);
  }
  if (!user.ugcTermsAcceptedAt) {
    throw new AppError(
      "Please accept the Community Guidelines before posting or replying.",
      403,
      "UGC_TERMS_REQUIRED",
    );
  }
};

export const createPostService = async (
  authorId: string,
  data: CreatePostPayload,
) => {
  await assertUserAcceptedUgcTerms(authorId);

  const validation = validateAndSanitizePost(data);
  if (validation.error) {
    throw new AppError(validation.error, 400);
  }

  // API-5: Never broadcast all-user notifications on forum post creation.
  return await forumRepository.createHelpPost(authorId, {
    title: validation.cleanTitle!,
    description: validation.cleanDescription!,
  });
};

export const getAllPostsService = async (
  query?: {
    page?: number | string;
    limit?: number | string;
    filter?: string;
    search?: string;
  },
  userId?: string,
  role?: string,
) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(query?.limit) || 15));
  const skip = (page - 1) * limit;

  const viewer = await forumRepository.getViewerModerationContext(userId, role);
  const isMyPosts = query?.filter === "MY_POSTS" && Boolean(userId);
  const where: Record<string, any> = forumRepository.buildVisibilityConditions(
    viewer,
    { includeOwnHidden: isMyPosts },
  );

  if (query?.filter === "UNRESOLVED") {
    where.isResolved = false;
  } else if (query?.filter === "RESOLVED") {
    where.isResolved = true;
  } else if (isMyPosts) {
    where.authorId = userId;
  }

  const searchKeyword =
    typeof query?.search === "string" ? query.search.trim() : undefined;
  if (searchKeyword) {
    where.OR = [
      { title: { contains: searchKeyword, mode: "insensitive" } },
      { description: { contains: searchKeyword, mode: "insensitive" } },
    ];
  }

  const [posts, total, counts] = await Promise.all([
    forumRepository.findHelpPosts(where, skip, limit, viewer),
    forumRepository.countHelpPosts(where),
    forumRepository.getForumCounts(viewer, userId),
  ]);

  return {
    data: posts,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      counts,
    },
  };
};

export const getSinglePostService = async (
  id: string,
  userId?: string,
  role?: string,
) => {
  const viewer = await forumRepository.getViewerModerationContext(userId, role);
  const post = await forumRepository.findHelpPostWithDetails(id, viewer);

  if (
    !post ||
    !isForumItemVisibleToViewer(
      {
        id: post.id,
        authorId: post.authorId,
        isHiddenByModeration: post.isHiddenByModeration,
      },
      "FORUM_POST",
      viewer,
    )
  ) {
    throw new AppError("Forum post not found.", 404);
  }

  return post;
};

export const createResponseService = async (
  postId: string,
  responderId: string,
  role: string,
  data: CreateResponsePayload,
) => {
  await assertUserAcceptedUgcTerms(responderId);

  const validation = validateAndSanitizeResponse(data.content);
  if (validation.error) {
    throw new AppError(validation.error, 400);
  }

  const { post, response, rootParentResponderId } = await prisma.$transaction(
    async (tx) => {
      // Lock post row in SHARE mode so concurrent replies parallelize while post resolve/delete serializes cleanly
      const lockedPost = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "HelpPost" WHERE id = ${postId} FOR SHARE
      `;
      if (lockedPost.length === 0) {
        throw new AppError("Forum post not found.", 404);
      }

      const currentPost = await forumRepository.findHelpPostById(postId, tx);

      if (
        !currentPost ||
        (currentPost.isHiddenByModeration && role !== "ADMIN")
      ) {
        throw new AppError("Forum post not found.", 404);
      }

      // Prevent posting replies to resolved threads unless Admin
      if (currentPost.isResolved && role !== "ADMIN") {
        throw new AppError(
          "Cannot reply to a resolved discussion. Please reopen the discussion or start a new topic.",
          403,
        );
      }

      let finalParentId = data.parentId ?? null;
      let parentAuthorId: string | null = null;

      if (finalParentId) {
        const parentResponse = await forumRepository.findHelpResponseById(
          finalParentId,
          tx,
        );
        if (
          !parentResponse ||
          parentResponse.postId !== postId ||
          (parentResponse.isHiddenByModeration && role !== "ADMIN")
        ) {
          throw new AppError("Parent response not found.", 404);
        }

        // Flatten if replying to an existing reply (maintains strict 2-tier hierarchy)
        if (parentResponse.parentId) {
          finalParentId = parentResponse.parentId;
          const rootResponse = await forumRepository.findHelpResponseById(
            finalParentId,
            tx,
          );
          if (
            !rootResponse ||
            rootResponse.postId !== postId ||
            (rootResponse.isHiddenByModeration && role !== "ADMIN")
          ) {
            throw new AppError("Parent response not found.", 404);
          }
          parentAuthorId = rootResponse.responderId;
        } else {
          parentAuthorId = parentResponse.responderId;
        }
      }

      const createdResponse = await forumRepository.createHelpResponse(
        postId,
        responderId,
        {
          content: validation.cleanContent!,
          parentId: finalParentId,
        },
        tx,
      );

      return {
        post: currentPost,
        response: createdResponse,
        rootParentResponderId: parentAuthorId,
      };
    },
  );

  const candidates = new Set<string>([post.authorId]);
  if (rootParentResponderId) {
    candidates.add(rootParentResponderId);
  }

  const recipients = filterForumNotificationRecipients(candidates, responderId);

  if (recipients.length > 0) {
    await createNotifications(recipients, {
      type: "FORUM_REPLY",
      title: "New forum reply",
      body: `Someone replied to “${post.title}”.`,
      route: `/(tabs)/forum/${postId}`,
      dedupeKey: `forum-reply:${response.id}`,
    });
  }

  return response;
};

export const resolvePostService = async (
  postId: string,
  userId: string,
  role: string,
  data?: ResolvePostPayload,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post || (post.isHiddenByModeration && role !== "ADMIN")) {
    throw new AppError("Forum post not found.", 404);
  }

  // Post author or Admin can toggle/set resolution state
  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to perform this action.",
      403,
    );
  }

  // Preserve updatedAt so resolving/reopening does not trigger spurious "(Edited)" UI badges
  const targetResolved =
    typeof data?.isResolved === "boolean" ? data.isResolved : !post.isResolved;

  return await forumRepository.updateHelpPost(postId, {
    isResolved: targetResolved,
    updatedAt: post.updatedAt,
  });
};

export const updatePostService = async (
  postId: string,
  userId: string,
  role: string,
  data: UpdatePostPayload,
) => {
  if (role !== "ADMIN") {
    await assertUserAcceptedUgcTerms(userId);
  }

  const post = await forumRepository.findHelpPostById(postId);

  if (!post || (post.isHiddenByModeration && role !== "ADMIN")) {
    throw new AppError("Forum post not found.", 404);
  }

  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError("You do not have permission to edit this post.", 403);
  }

  if (post.isResolved && role !== "ADMIN") {
    throw new AppError(
      "Cannot edit a resolved discussion. Please reopen the discussion first.",
      403,
    );
  }

  const validation = validateAndSanitizePost(data);
  if (validation.error) {
    throw new AppError(validation.error, 400);
  }

  const updateData: UpdatePostPayload = {};
  if (validation.cleanTitle !== undefined) {
    updateData.title = validation.cleanTitle;
  }
  if (validation.cleanDescription !== undefined) {
    updateData.description = validation.cleanDescription;
  }

  return await forumRepository.updateHelpPost(postId, updateData);
};

export const deletePostService = async (
  postId: string,
  userId: string,
  role: string,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to perform this action.",
      403,
    );
  }

  return await forumRepository.deleteHelpPostById(postId);
};

export const updateResponseService = async (
  postId: string,
  responseId: string,
  userId: string,
  role: string,
  data: UpdateResponsePayload,
) => {
  if (role !== "ADMIN") {
    await assertUserAcceptedUgcTerms(userId);
  }

  const [post, response] = await Promise.all([
    forumRepository.findHelpPostById(postId),
    forumRepository.findHelpResponseById(responseId),
  ]);

  if (!post || (post.isHiddenByModeration && role !== "ADMIN")) {
    throw new AppError("Forum post not found.", 404);
  }

  if (post.isResolved && role !== "ADMIN") {
    throw new AppError("Cannot edit responses on a resolved discussion.", 403);
  }

  if (
    !response ||
    response.postId !== postId ||
    (response.isHiddenByModeration && role !== "ADMIN")
  ) {
    throw new AppError("Response not found.", 404);
  }

  if (response.responderId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to edit this response.",
      403,
    );
  }

  const validation = validateAndSanitizeResponse(data.content);
  if (validation.error) {
    throw new AppError(validation.error, 400);
  }

  return await forumRepository.updateHelpResponse(
    responseId,
    { content: validation.cleanContent! },
    userId,
  );
};

export const deleteResponseService = async (
  postId: string,
  responseId: string,
  userId: string,
  role: string,
) => {
  const response = await forumRepository.findHelpResponseById(responseId);

  if (!response || response.postId !== postId) {
    throw new AppError("Response not found.", 404);
  }

  if (response.responderId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to delete this response.",
      403,
    );
  }

  return await forumRepository.deleteHelpResponseById(responseId);
};

export const toggleResponseReactionService = async (
  postId: string,
  responseId: string,
  userId: string,
  role: string,
  data: ReactResponsePayload,
) => {
  const [post, response, viewer] = await Promise.all([
    forumRepository.findHelpPostById(postId),
    forumRepository.findHelpResponseById(responseId),
    forumRepository.getViewerModerationContext(userId, role),
  ]);

  if (
    !post ||
    !isForumItemVisibleToViewer(
      {
        id: post.id,
        authorId: post.authorId,
        isHiddenByModeration: post.isHiddenByModeration,
      },
      "FORUM_POST",
      viewer,
    )
  ) {
    throw new AppError("Forum post not found.", 404);
  }

  if (
    !response ||
    response.postId !== postId ||
    !isForumItemVisibleToViewer(
      {
        id: response.id,
        authorId: response.responderId,
        isHiddenByModeration: response.isHiddenByModeration,
      },
      "FORUM_RESPONSE",
      viewer,
    )
  ) {
    throw new AppError("Response not found.", 404);
  }

  return await forumRepository.toggleHelpResponseReaction(
    responseId,
    userId,
    data.type,
  );
};

export const reportForumContentService = async (
  reporterId: string,
  data: CreateForumReportPayload,
) => {
  let targetAuthorId: string | null = null;
  let targetUpdatedAt: Date;
  let targetSnapshot: Record<string, any>;

  if (data.targetType === "FORUM_POST") {
    const post = await forumRepository.findHelpPostById(data.targetId);
    if (!post || post.isHiddenByModeration) {
      throw new AppError("Forum post not found.", 404);
    }
    if (post.authorId === reporterId) {
      throw new AppError("You cannot report your own post.", 400);
    }
    targetAuthorId = post.authorId;
    targetUpdatedAt = post.updatedAt;
    targetSnapshot = {
      postId: post.id,
      title: post.title,
      contentPreview: extractPlainText(post.description).slice(0, 400),
    };
  } else {
    const response = await forumRepository.findHelpResponseById(data.targetId);
    if (!response || response.isHiddenByModeration) {
      throw new AppError("Response not found.", 404);
    }
    if (response.responderId === reporterId) {
      throw new AppError("You cannot report your own response.", 400);
    }
    targetAuthorId = response.responderId;
    targetUpdatedAt = response.updatedAt;
    targetSnapshot = {
      postId: response.postId,
      responseId: response.id,
      contentPreview: extractPlainText(response.content).slice(0, 400),
    };
  }

  const existing = await forumRepository.findExistingUserReport(
    reporterId,
    data.targetType,
    data.targetId,
  );

  let reopenReportId: string | undefined;
  if (existing) {
    if (existing.status !== "DISMISSED") {
      throw new AppError("You have already reported this content.", 409);
    }
    const reviewedBoundary = existing.reviewedAt ?? existing.createdAt;
    if (targetUpdatedAt <= reviewedBoundary) {
      throw new AppError(
        "A moderator has already reviewed this content.",
        409,
      );
    }
    reopenReportId = existing.id;
  }

  return await forumRepository.createContentReportAndEvaluateAutoHide({
    reporterId,
    targetType: data.targetType,
    targetId: data.targetId,
    targetAuthorId,
    reason: data.reason,
    details: data.details,
    targetSnapshot,
    reopenReportId,
  });
};
