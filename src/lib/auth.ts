/** The one browser-safe redirect target for Supabase email actions. */
export function getAuthRedirectUrl() {
  return window.location.origin;
}

/** Supabase has already exchanged the callback before auth events are emitted. */
export function clearAuthCallbackUrl() {
  if (window.location.hash.includes("access_token") || window.location.hash.includes("refresh_token") || new URLSearchParams(window.location.search).has("code")) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search.replace(/([?&])code=[^&]*&?/, "$1").replace(/[?&]$/, "")}`);
  }
}

export function friendlyAuthError(error: unknown) {
  const message = getAuthErrorMessage(error);
  if (message.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (message.includes("already registered") || message.includes("already been registered")) return "An account already exists for this email. Try signing in instead.";
  if (message.includes("email not confirmed")) return "Confirm your email address before signing in.";
  if (message.includes("expired") || message.includes("otp")) return "This link has expired. Request a new one and try again.";
  if (isAuthRateLimited(error)) return "Too many email requests were made in a short time. Please wait a few minutes before trying again.";
  if (message.includes("network") || message.includes("fetch")) return "We couldn't connect right now. Check your connection and try again.";
  return "We could not complete that request. Please try again.";
}

export function isAuthRateLimited(error: unknown) {
  const message = getAuthErrorMessage(error);
  const status = typeof error === "object" && error !== null && "status" in error ? String((error as { status?: unknown }).status) : "";
  return status === "429" || message.includes("rate limit") || message.includes("too many requests") || message.includes("security purposes") || message.includes("429") || message.includes("email rate");
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === "object" && error !== null && "message" in error) return String((error as { message?: unknown }).message ?? "").toLowerCase();
  return "";
}
