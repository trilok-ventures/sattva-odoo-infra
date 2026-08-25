"use client";

export function SignOutButton() {
  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    window.location.href = "/";
  }

  return (
    <button type="button" className="btn ghost" onClick={signOut}>
      Sign out
    </button>
  );
}
