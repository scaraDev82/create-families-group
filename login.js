import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const form = document.getElementById("login-form");
const feedback = document.getElementById("feedback");
const emailInput = document.getElementById("email");

registerServiceWorker();

if (!isSupabaseConfigured) {
  setFeedback("Supabase n'est pas configuré. Mettez à jour config.js.", "error");
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
      setFeedback("L'e-mail est obligatoire.", "error");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${returnTo}`,
      },
    });

    if (error) {
      setFeedback(`Échec de connexion: ${error.message}`, "error");
      return;
    }

    setFeedback("Lien magique envoyé. Vérifiez votre e-mail et ouvrez le lien sur cet appareil.", "success");
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
