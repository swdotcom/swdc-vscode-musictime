import { authenticationCompleteHandler, updatedAuthAdded } from "../managers/UserStatusManager";

export async function handleAuthenticatedPluginUser(user: any) {
  updatedAuthAdded(true);
  authenticationCompleteHandler(user);
}
