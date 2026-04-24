const NATIVE_CHANGE_CONTROL_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

export function shouldDispatchClickAction(target) {
  if (!target?.tagName) return false;
  if (target.tagName === 'FORM') return false;
  return !NATIVE_CHANGE_CONTROL_TAGS.has(target.tagName);
}
