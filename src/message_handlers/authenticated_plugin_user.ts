import { authenticationCompleteHandler } from '../managers/UserStatusManager';

export async function handleAuthenticatedPluginUser(user: any) {
  authenticationCompleteHandler(user);
}
