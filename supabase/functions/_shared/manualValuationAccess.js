const publicActions = new Set(['begin', 'upload', 'remove_photo', 'submit']);
const staffActions = new Set(['save', 'note', 'convert']);

export function manualValuationAccess(action) {
  return {
    allowed: publicActions.has(action) || staffActions.has(action),
    requiresStaff: staffActions.has(action),
    internal: staffActions.has(action),
  };
}
