import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const form = document.getElementById("login-form");
const feedback = document.getElementById("feedback");
const emailInput = document.getElementById("email");

registerServiceWorker();

if (!isSupabaseConfigured) {
  setFeedback("Supabase is not configured. Update config.js first.", "error");
} else {
  const params = new URLSearchParams(window.location.search);
  const returnTo = sanitizeReturnTo(params.get("returnTo"));

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    window.location.href = returnTo;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    if (!email) {
      setFeedback("Email is required.", "error");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${returnTo}`,
      },
    });

    if (error) {
      setFeedback(`Login failed: ${error.message}`, "error");
      return;
    }

    setFeedback("Magic link sent. Check your email and open it on this device.", "success");
  });
}

function sanitizeReturnTo(value) {
  if (!value || typeof value !== "string") {
    return "/index.html";
  }
  if (!value.startsWith("/")) {
    return "/index.html";
  }
  return value;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

function setFeedback(message, type = "info") {
  if (!feedback) {
    return;
  }

  feedback.className = `feedback show feedback-${type}`;
  feedback.textContent = message;
}
