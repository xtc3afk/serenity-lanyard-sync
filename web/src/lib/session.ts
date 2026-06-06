// Session helpers - reads the signed Discord OAuth cookie set by the API
// The API at api.whimper.wtf sets a `whimper_session` httpOnly cookie after OAuth.
// We just read /auth/me which validates it server-side.

import { api, type WhimperUser } from "./api";

export const ADMIN_IDS = [
  "1216023255878471763",
  "1222982434803417181",
];

export function isAdmin(user: WhimperUser | null): boolean {
  if (!user) return false;
  return ADMIN_IDS.includes(user.discordId);
}