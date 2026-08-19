"use client";

import { useState } from "react";

export function DocumentUploadForm() {
  const [filename, setFilename] = useState("");
  const [sha256, setSha256] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename, sha256 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "upload_failed");
        return;
      }
      const q = new URLSearchParams({
        filename,
        sha256: sha256.toLowerCase(),
      });
      window.location.href = `/p2/receipt?${q.toString()}`;
    } catch {
      setError("network_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 480 }}>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span className="caption">Filename (no path)</span>
        <input
          type="text"
          name="filename"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          required
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span className="caption">SHA-256 (64 hex)</span>
        <input
          type="text"
          name="sha256"
          value={sha256}
          onChange={(e) => setSha256(e.target.value)}
          pattern="[a-fA-F0-9]{64}"
          required
          style={{ display: "block", width: "100%", marginTop: 4, fontFamily: "monospace" }}
        />
      </label>
      {error ? (
        <p className="caption" style={{ color: "#8b2e2e" }}>
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? "Uploading…" : "Submit metadata"}
      </button>
    </form>
  );
}
