"use client";

import { useMemo, useState } from "react";
import type { AppRole } from "@/lib/auth";

type WorkflowStage = "Sales" | "AccountManager" | "LogisticsService";

type Offer = {
  label: string;
  cost: string;
  clientPrice: string;
};

const stageOrder: WorkflowStage[] = ["Sales", "AccountManager", "LogisticsService"];

export function CrmWorkspace({ role }: { role: AppRole }) {
  const [stage, setStage] = useState<WorkflowStage>("Sales");

  const [lead, setLead] = useState({
    fullName: "Ivan Petrov",
    egn: "9001011234",
    address: "Sofia, Mladost 4",
    phone: "+359888123456",
    email: "ivan.petrov@email.com",
    vehicleRequest: "BMW X5 2021 M50d, under 90,000 km, panoramic roof, adaptive cruise",
  });

  const [accountData, setAccountData] = useState({
    vehicleBrand: "BMW",
    vehicleModel: "X5",
    vehicleYear: "2021",
    vehicleModification: "M50d",
    mileage: "86500",
    extras: "Panorama, 360 camera, head-up display",
    purchasePrice: "45200",
    vin: "WBA12345678901234",
    purchasedFrom: "Munich dealer, Germany",
    transportPrice: "1450",
    warrantyPrice: "900",
    clientListedPrice: "51900",
  });

  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState<string[]>([
    "Client approved budget up to 52,000 EUR.",
    "Prioritizes one-owner vehicles with full service history.",
  ]);

  const [linkInput, setLinkInput] = useState("");
  const [docLinks, setDocLinks] = useState<string[]>([
    "https://example.com/offer-sheet/7c-2026-001",
    "https://example.com/purchase-contract/7c-2026-001",
  ]);

  const [logisticsData, setLogisticsData] = useState({
    vehicleCondition: "No structural damage, minor front bumper scratches.",
    postServiceCheck: "Engine and transmission healthy. Brake pads recommended in 6,000 km.",
  });

  const [offers, setOffers] = useState<Offer[]>([
    { label: "Registration", cost: "280", clientPrice: "420" },
    { label: "Insurance", cost: "610", clientPrice: "780" },
    { label: "Maintenance", cost: "540", clientPrice: "760" },
    { label: "Detailing", cost: "160", clientPrice: "290" },
  ]);

  const [serviceFiles, setServiceFiles] = useState({
    inspectionProtocol: "",
    serviceQuote: "",
  });

  const activeStageIdx = stageOrder.indexOf(stage);
  const roleStageAllowed = useMemo(() => {
    if (role === "Admin") return true;
    if (role === "Sales") return activeStageIdx >= 0;
    if (role === "AccountManager") return activeStageIdx >= 1;
    if (role === "Logistics" || role === "Service") return activeStageIdx >= 2;
    return false;
  }, [activeStageIdx, role]);

  const canMoveToAccount = role === "Sales" || role === "Admin";
  const canMoveToLogistics = role === "AccountManager" || role === "Admin";

  function addComment() {
    const value = commentInput.trim();
    if (!value) return;
    setComments((prev) => [value, ...prev]);
    setCommentInput("");
  }

  function addDocLink() {
    const value = linkInput.trim();
    if (!value) return;
    setDocLinks((prev) => [value, ...prev]);
    setLinkInput("");
  }

  if (!roleStageAllowed) {
    return (
      <section className="card p-5">
        <h2 className="brand-title text-lg font-semibold">Role Workspace</h2>
        <p className="mt-2 text-sm text-gray-700">
          Current stage is <strong>{stage}</strong>. Your role is <strong>{role}</strong> and cannot access this stage yet.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="brand-title text-lg font-semibold">Role Workspace</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="badge badge-blue">Stage: {stage}</span>
          <span className="badge brand-chip">Role: {role}</span>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        <p className="font-semibold">Workflow</p>
        <p className="text-gray-700">Sales -&gt; AccountManager -&gt; Logistics/Service (Admin sees all)</p>
      </div>

      {(role === "Sales" || role === "Admin") && (
        <article className="module-shell mb-5">
          <div className="module-header">
            <h3 className="module-title">Leads Module (Sales)</h3>
            <span className="badge brand-chip">Lead Intake</span>
          </div>
          <div className="module-body">
            <div className="overflow-x-auto">
              <table className="brand-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>EGN</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Vehicle Request</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{lead.fullName}</td>
                    <td>{lead.egn}</td>
                    <td>{lead.phone}</td>
                    <td>{lead.email}</td>
                    <td>{lead.vehicleRequest}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="form-grid mt-4 md:grid-cols-2">
              <Field label="Full Name" value={lead.fullName} onChange={(v) => setLead((s) => ({ ...s, fullName: v }))} />
              <Field label="EGN" value={lead.egn} onChange={(v) => setLead((s) => ({ ...s, egn: v }))} />
              <Field label="Address" value={lead.address} onChange={(v) => setLead((s) => ({ ...s, address: v }))} />
              <Field label="Phone" value={lead.phone} onChange={(v) => setLead((s) => ({ ...s, phone: v }))} />
              <Field label="Email" value={lead.email} onChange={(v) => setLead((s) => ({ ...s, email: v }))} />
              <Field
                label="Requested Vehicle Description"
                value={lead.vehicleRequest}
                onChange={(v) => setLead((s) => ({ ...s, vehicleRequest: v }))}
              />
            </div>
            {canMoveToAccount && (
              <button type="button" className="brand-btn mt-4 px-4 py-2 text-sm font-semibold" onClick={() => setStage("AccountManager")}>
                Mark Successful and Handover to AccountManager
              </button>
            )}
          </div>
        </article>
      )}

      {(role === "AccountManager" || role === "Admin") && activeStageIdx >= 1 && (
        <article className="module-shell mb-5">
          <div className="module-header">
            <h3 className="module-title">Deals Module (AccountManager)</h3>
            <span className="badge brand-chip">Sourcing & Purchase</span>
          </div>
          <div className="module-body">
            <div className="form-grid md:grid-cols-2">
              <Field label="Brand" value={accountData.vehicleBrand} onChange={(v) => setAccountData((s) => ({ ...s, vehicleBrand: v }))} />
              <Field label="Model" value={accountData.vehicleModel} onChange={(v) => setAccountData((s) => ({ ...s, vehicleModel: v }))} />
              <Field label="Year" value={accountData.vehicleYear} onChange={(v) => setAccountData((s) => ({ ...s, vehicleYear: v }))} />
              <Field
                label="Modification"
                value={accountData.vehicleModification}
                onChange={(v) => setAccountData((s) => ({ ...s, vehicleModification: v }))}
              />
              <Field label="Mileage" value={accountData.mileage} onChange={(v) => setAccountData((s) => ({ ...s, mileage: v }))} />
              <Field label="Extras" value={accountData.extras} onChange={(v) => setAccountData((s) => ({ ...s, extras: v }))} />
              <Field
                label="Purchase Price"
                value={accountData.purchasePrice}
                onChange={(v) => setAccountData((s) => ({ ...s, purchasePrice: v }))}
              />
              <Field label="VIN (Frame)" value={accountData.vin} onChange={(v) => setAccountData((s) => ({ ...s, vin: v }))} />
              <Field
                label="Purchased From"
                value={accountData.purchasedFrom}
                onChange={(v) => setAccountData((s) => ({ ...s, purchasedFrom: v }))}
              />
              <Field
                label="Transport Price"
                value={accountData.transportPrice}
                onChange={(v) => setAccountData((s) => ({ ...s, transportPrice: v }))}
              />
              <Field
                label="Warranty Price"
                value={accountData.warrantyPrice}
                onChange={(v) => setAccountData((s) => ({ ...s, warrantyPrice: v }))}
              />
              <Field
                label="Listed Price To Client"
                value={accountData.clientListedPrice}
                onChange={(v) => setAccountData((s) => ({ ...s, clientListedPrice: v }))}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-2 text-sm font-semibold">Comments</p>
                <div className="mb-2 flex gap-2">
                  <input
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    className="brand-input"
                    placeholder="Add comment"
                  />
                  <button type="button" onClick={addComment} className="mini-btn">
                    Add
                  </button>
                </div>
                <ul className="space-y-1 text-sm text-gray-700">
                  {comments.map((comment) => (
                    <li key={comment} className="rounded border border-gray-200 bg-gray-50 p-2">
                      {comment}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-2 text-sm font-semibold">Online Document Links</p>
                <div className="mb-2 flex gap-2">
                  <input
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    className="brand-input"
                    placeholder="https://..."
                  />
                  <button type="button" onClick={addDocLink} className="mini-btn">
                    Add
                  </button>
                </div>
                <ul className="space-y-1 text-sm text-blue-700">
                  {docLinks.map((link) => (
                    <li key={link} className="truncate rounded border border-blue-100 bg-blue-50 p-2">
                      {link}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {canMoveToLogistics && (
              <button type="button" className="brand-btn mt-4 px-4 py-2 text-sm font-semibold" onClick={() => setStage("LogisticsService")}>
                Handover to Logistics and Service
              </button>
            )}
          </div>
        </article>
      )}

      {(role === "Logistics" || role === "Admin") && activeStageIdx >= 2 && (
        <article className="module-shell mb-5">
          <div className="module-header">
            <h3 className="module-title">Logistics Module</h3>
            <span className="badge brand-chip">After Purchase Operations</span>
          </div>
          <div className="module-body">
            <div className="form-grid md:grid-cols-2">
              <Field
                label="Vehicle Condition"
                value={logisticsData.vehicleCondition}
                onChange={(v) => setLogisticsData((s) => ({ ...s, vehicleCondition: v }))}
              />
              <Field
                label="Post-Service Check"
                value={logisticsData.postServiceCheck}
                onChange={(v) => setLogisticsData((s) => ({ ...s, postServiceCheck: v }))}
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="brand-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Cost Price</th>
                    <th>Client Price</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer, idx) => (
                    <tr key={offer.label}>
                      <td>{offer.label}</td>
                      <td>
                        <input
                          className="brand-input"
                          value={offer.cost}
                          onChange={(v) =>
                            setOffers((prev) => prev.map((item, i) => (i === idx ? { ...item, cost: v.target.value } : item)))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="brand-input"
                          value={offer.clientPrice}
                          onChange={(v) =>
                            setOffers((prev) => prev.map((item, i) => (i === idx ? { ...item, clientPrice: v.target.value } : item)))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      )}

      {(role === "Service" || role === "Admin") && activeStageIdx >= 2 && (
        <article className="module-shell">
          <div className="module-header">
            <h3 className="module-title">Service Module</h3>
            <span className="badge brand-chip">Inspection & Offer Upload</span>
          </div>
          <div className="module-body">
            <p className="mb-3 text-sm text-gray-700">Service can upload only vehicle inspection protocol and service offer.</p>
            <div className="form-grid md:grid-cols-2">
              <FileField
                label="Inspection Protocol"
                value={serviceFiles.inspectionProtocol}
                onChange={(v) => setServiceFiles((s) => ({ ...s, inspectionProtocol: v }))}
              />
              <FileField
                label="Service Offer"
                value={serviceFiles.serviceQuote}
                onChange={(v) => setServiceFiles((s) => ({ ...s, serviceQuote: v }))}
              />
            </div>
          </div>
        </article>
      )}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="brand-input" />
    </label>
  );
}

function FileField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input type="file" onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")} className="brand-input" />
      {value ? <p className="mt-1 text-xs text-gray-600">Uploaded: {value}</p> : null}
    </label>
  );
}
