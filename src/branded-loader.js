const loaderId = "weblox-branded-loader";
const authLoaderKey = "weblox-auth-loader";
const minimumLoaderDuration = 3500;
let loaderShownAt = 0;
let pendingDismissTimer;

function ensureLoader() {
  let loader = document.getElementById(loaderId);
  if (loader) return loader;

  loader = document.createElement("div");
  loader.id = loaderId;
  loader.className = "weblox-branded-loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-live", "polite");
  loader.setAttribute("aria-label", "Loading WEBLOX");
  loader.innerHTML =
    '<img src="/assets/weblox-logo.png" alt="WEBLOX Studios" />';
  document.body.prepend(loader);
  return loader;
}

export function showBrandedLoader() {
  const loader = ensureLoader();
  loaderShownAt = Date.now();
  clearTimeout(pendingDismissTimer);
  loader.classList.remove("is-hidden");
  return loader;
}

export function dismissBrandedLoader() {
  const loader = document.getElementById(loaderId);
  if (!loader) return;
  const remaining = minimumLoaderDuration - (Date.now() - loaderShownAt);
  if (remaining > 0) {
    clearTimeout(pendingDismissTimer);
    pendingDismissTimer = setTimeout(dismissBrandedLoader, remaining);
    return;
  }
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  loader.classList.add("is-hidden");
  if (reducedMotion) {
    loader.remove();
    return;
  }
  loader.addEventListener("transitionend", () => loader.remove(), {
    once: true,
  });
}

window.webloxShowBrandedLoader = showBrandedLoader;
window.webloxDismissBrandedLoader = dismissBrandedLoader;

function dismissInitialLoader() {
  if (document.getElementById(loaderId)) {
    loaderShownAt = Date.now();
    requestAnimationFrame(dismissBrandedLoader);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", dismissInitialLoader, {
    once: true,
  });
} else {
  dismissInitialLoader();
}
