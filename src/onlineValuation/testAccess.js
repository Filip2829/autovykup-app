export function isPublicTestPath(path, publicTestEnabled) {
  return publicTestEnabled === 'true' && path.replace(/\/$/, '') === '/naceneni-vozu';
}
