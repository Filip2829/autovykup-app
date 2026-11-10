export function canUseStandaloneStudio(user, staff) {
  return !!user?.id && !user.is_anonymous && (Boolean(staff) || user.app_metadata?.photo_studio_access === true);
}
export function standaloneStudioRoot(userId) {
  return `photo-studio-sales/${userId}`;
}
