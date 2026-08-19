"use client";

import { useState } from "react";
import Link from "next/link";
import type { PurchaseOrder } from "@/lib/adapters/types";
import { GateDialog } from "../components/GateDialog";
import { StatusPill } from "../components/StatusPill";
import { SCREENS } from "@/lib/screen-graph";

type GatePayload = {
  title: string;
  message: string;
};

export function PoGateClient({ initialOrders }: { initialOrders: PurchaseOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [gate, setGate] = useState<GatePayload | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function confirmOrder(id: string) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/purchase/orders/${id}/confirm`, { method: "POST" });
      const body = await res.json();
      if (res.status === 409) {
        setGate({ title: body.title, message: body.message });
        return;
      }
      if (res.ok && body.state === "purchase") {
        setOrders((prev) =>
          prev.map((row) =>
            row.id === id ? { ...row, state: "purchase" } : row,
          ),
        );
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>PO</th>
            <th>Supplier</th>
            <th>Gate</th>
            <th>State</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>
                <Link href={SCREENS.E3}>{row.partner_display}</Link>
              </td>
              <td><StatusPill status={row.gate} /></td>
              <td>{row.state}</td>
              <td>
                {row.state === "purchase" ? (
                  <span className="caption">already purchase</span>
                ) : (
                  <button
                    type="button"
                    disabled={pendingId === row.id}
                    onClick={() => confirmOrder(row.id)}
                  >
                    Confirm order
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {gate ? (
        <GateDialog
          title={gate.title}
          message={gate.message}
          onClose={() => setGate(null)}
          dossierHref={SCREENS.E3}
        />
      ) : null}
    </>
  );
}
