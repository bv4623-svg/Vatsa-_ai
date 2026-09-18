/** Maps a thrown signup error's message to where it belongs on the form --
 * next to the email field for a duplicate account, otherwise a banner. */
export function describeSignupError(message: string): { emailError?: string; formError?: string } {
  const lower = message.toLowerCase();
  if (lower.includes("already registered")) {
    return { emailError: "That email already has an account. Sign in instead." };
  }
  if (lower.includes("failed to fetch")) {
    return { formError: "Can't reach the server. Check your connection and try again." };
  }
  return { formError: message || "Could not send a verification code. Try again." };
}
