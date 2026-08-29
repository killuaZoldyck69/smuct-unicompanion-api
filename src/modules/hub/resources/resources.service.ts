import { verifyHubRole } from "../hub.service";
import * as resourcesRepository from "./resources.repository";
import { CreateResourcePayload } from "./resources.schema";

export const createResourceService = async (
  userId: string,
  hubId: string,
  data: CreateResourcePayload,
) => {
  // All members can upload resources (Teachers upload lectures, Students upload notes)
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await resourcesRepository.createResource(userId, hubId, data);
};

export const getResourcesService = async (hubId: string) => {
  return await resourcesRepository.findResourcesByHubId(hubId);
};
