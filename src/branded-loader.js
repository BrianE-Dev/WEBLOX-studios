const loaderId = "weblox-branded-loader";
const authLoaderKey = "weblox-auth-loader";

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
  loader.classList.remove("is-hidden");
  return loader;
}

export function dismissBrandedLoader() {
  const loader = document.getElementById(loaderId);
  if (!loader) return;
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
  if (document.getElementById(loaderId))
    requestAnimationFrame(dismissBrandedLoader);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", dismissInitialLoader, {
    once: true,
  });
} else {
  dismissInitialLoader();
}
