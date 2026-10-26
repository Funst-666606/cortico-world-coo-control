/** Minimal fixture with the page's body setup line. */
const prefs = { roam: 'free' };
const bodyState = { listening: false };
let body = null, words = new Map(), T = 0;
async function showFigure() {
  const next = { set() {}, dispose() {} };
  next.set({ roam: prefs.roam, ...bodyState });
  body = next;
}
