"use client";

type GateDialogProps = {
  title: string;
  message: string;
  onClose: () => void;
  dossierHref: string;
};

export function GateDialog({ title, message, onClose, dossierHref }: GateDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26, 26, 26, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 480, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="gate-dialog-title" style={{ marginTop: 0 }}>{title}</h2>
        <p>{message}</p>
        <p>
          <a href={dossierHref}>View supplier compliance</a>
        </p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
