// Page focus on load. Leaf module (AD-5): imports nothing.
// Only after a same-origin link navigation without a fragment; typed URLs,
// reloads and history traversal keep the browser default.
const entry = performance.getEntriesByType('navigation')[0];
const type = entry && 'type' in entry ? (entry as PerformanceNavigationTiming).type : undefined;

let sameOrigin = false;
try {
  sameOrigin = document.referrer !== '' && new URL(document.referrer).origin === location.origin;
} catch {
  sameOrigin = false;
}

if (type === 'navigate' && sameOrigin && !location.hash) {
  const heading = document.getElementById('page-heading');
  if (heading) heading.focus({ preventScroll: true });
}
