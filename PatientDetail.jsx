import React, { useRef } from "react";
import { useEffect, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import * as d3 from "d3-force";
import {
  fetchPatient,
  fetchTranscript,
  fetchPatientBaseline,
} from "./api.js";

// Same display order + labels as the patient PWA's done screen, for consistency.
const DISPLAY_CATEGORIES = [
  { key: "MEDICAL_CONDITION", label: "Symptoms" },
  { key: "ANATOMY", label: "Body location" },
  { key: "MEDICATION", label: "Medications" },
  { key: "TIME_EXPRESSION", label: "Timing" },
];

function classForCategory(c) {
  return {
    MEDICAL_CONDITION: "condition",
    MEDICATION: "medication",
    ANATOMY: "anatomy",
    TIME_EXPRESSION: "time",
  }[c] || "other";
}

function titleCase(value) {
  if (!value) return "Stable";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";

  const n = Number(value);

  if (!Number.isFinite(n)) return "—";

  return `${n > 0 ? "+" : ""}${n}%`;
}

function getDeviationSummary(voiceDeviation) {
  if (!voiceDeviation?.compared) {
    return "Not enough prior voice feature data is available for comparison.";
  }

  const level = voiceDeviation.deviationLevel || "stable";

  if (level === "stable") {
  return "Voice pattern appears stable relative to personal baseline. No meaningful deviation detected.";
}

  if (level === "mild") {
    return "Mild voice changes detected compared with personal baseline.";
  }

  if (level === "moderate") {
    return "Moderate voice changes detected compared with personal baseline.";
  }

  if (level === "significant") {
    return "Significant voice changes detected compared with personal baseline.";
  }

  return "Voice pattern compared with personal baseline.";
}

function getFeatureInterpretation(feature) {
  const direction = feature?.direction || "stable";
  const severity = feature?.severity || "stable";

  if (severity === "stable" || direction === "stable") {
    return "No meaningful change from personal baseline.";
  }

  const directionText =
    direction === "increased" ? "higher than" : "lower than";

  const map = {
    speechTempo: `Speaking tempo is ${directionText} personal baseline.`,
    meanPauseDuration: `Pause duration is ${directionText} personal baseline.`,
    pauseFrequency: `Pause frequency is ${directionText} personal baseline.`,
    voiceEnergy: `Voice energy is ${directionText} personal baseline.`,
    voiceExpressiveness: `Voice expressiveness is ${directionText} personal baseline.`,
    breathSupport: `Breath support measure is ${directionText} personal baseline.`,
    speechHesitations: `Speech hesitation pattern is ${directionText} personal baseline.`,
  };

  return map[feature?.metric] || "Changed compared with personal baseline.";
}

function getSeverityIcon(severity) {
  return {
    stable: "🟢",
    mild: "🟡",
    moderate: "🟠",
    significant: "🔴",
  }[severity] || "🟢";
}

export default function PatientDetail({
  patientId,
  clinicId,
  clinicianKey,
  onBack,
  onLogout,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [showBaselineDetails, setShowBaselineDetails] = useState(false);

  const [fusionSummary, setFusionSummary] = useState(null);
  const [fusionLoading, setFusionLoading] = useState(false);

  const [signalGraph, setSignalGraph] = useState(null);
  const [signalGraphLoading, setSignalGraphLoading] = useState(false);
  const [selectedSignalNode, setSelectedSignalNode] = useState(null);

  const [temporalTimeline, setTemporalTimeline] = useState(null);
  const [temporalLoading, setTemporalLoading] = useState(false);

const graphRef = useRef();

  const voiceDeviation =
    baseline?.voiceFeatures?.latest?.payload?.features?.voiceDeviation || null;
  // Transcript state: defaulted closed, loaded on demand.
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
  fetchPatient({ patientId, clinicianKey, clinicId }),
  fetchPatientBaseline({ patientId, clinicianKey, clinicId }),
])
  .then(([patientData, baselineData]) => {
  setData(patientData);
  setBaseline(baselineData);

  loadFusionSummary();
  loadSignalGraph();
  loadTemporalTimeline();
})
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) onLogout();
        else setError(err.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId, clinicId, clinicianKey, onLogout]);
useEffect(() => {
  if (!graphRef.current || !signalGraph) return;

  const fg = graphRef.current;

  requestAnimationFrame(() => {
    fg.centerAt(0, 30, 0);
    fg.zoom(0.92, 0);
  });
}, [signalGraph]);

async function loadFusionSummary() {
  if (!patientId) return;

  setFusionLoading(true);

  try {
    const res = await fetch(
      `https://dex-proxy-production.up.railway.app/api/fusion/${encodeURIComponent(patientId)}/summary`,
      {
        headers: {
          "X-Clinician-Key": clinicianKey,
        },
      }
    );

    const data = await res.json();

    if (data?.ok) {
      setFusionSummary(data);
    } else {
      setFusionSummary(null);
    }
  } catch (err) {
    console.error("Fusion summary failed:", err);
    setFusionSummary(null);
  } finally {
    setFusionLoading(false);
  }
}

async function loadSignalGraph() {
  if (!patientId) return;

  setSignalGraphLoading(true);

  try {
    const res = await fetch(
      `https://dex-proxy-production.up.railway.app/api/fusion/${encodeURIComponent(patientId)}/graph`,
      {
        headers: {
          "X-Clinician-Key": clinicianKey,
        },
      }
    );

    const data = await res.json();

    if (data?.ok) {
  console.log("GRAPH NODES", data.graph.nodes);
  setSignalGraph(data.graph);
} else {
      setSignalGraph(null);
    }
  } catch (err) {
    console.error("Signal graph failed:", err);
    setSignalGraph(null);
  } finally {
    setSignalGraphLoading(false);
  }
}

async function loadTemporalTimeline() {
  if (!patientId) return;

  setTemporalLoading(true);

  try {
    const res = await fetch(
      `https://dex-proxy-production.up.railway.app/api/fusion/${encodeURIComponent(patientId)}/timeline`,
      {
        headers: {
          "X-Clinician-Key": clinicianKey,
        },
      }
    );

    const data = await res.json();

    if (data?.ok) {
      setTemporalTimeline(data.timeline);
    } else {
      setTemporalTimeline(null);
    }
  } catch (err) {
    console.error("Temporal timeline failed:", err);
    setTemporalTimeline(null);
  } finally {
    setTemporalLoading(false);
  }
}

async function handleToggleTranscript() {
    if (showTranscript) {
      setShowTranscript(false);
      return;
    }
    if (transcript) {
      setShowTranscript(true);
      return;
    }
    setTranscriptLoading(true);
    setTranscriptError(null);
    try {
      const t = await fetchTranscript({ patientId, clinicianKey, clinicId });
      setTranscript(t);
      setShowTranscript(true);
    } catch (err) {
      setTranscriptError(err.message);
    } finally {
      setTranscriptLoading(false);
    }
  }

  if (loading) return <div className="page-loading">Loading patient…</div>;
  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="btn-text" onClick={onBack}>‹ Back to roster</button>
        </header>
        <div className="banner-error">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  const { patient, vitals } = data;
  const entities = patient.latestEntities || [];
  const buckets = DISPLAY_CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    items: entities.filter((e) => e.category === key),
  })).filter((b) => b.items.length > 0);

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-text" onClick={onBack}>‹ Back to roster</button>
        <button className="btn-text" onClick={onLogout}>Sign out</button>
      </header>

      {/* ── Patient header card ──────────────────────────────────────────── */}
      <div className="detail-header-card">
        <div className="detail-name">{patient.name || "Unnamed patient"}</div>
             <div className="detail-meta">
      {getPatientAge(patient) && (
        <span>Age {getPatientAge(patient)}</span>
      )}

      {patient.sex && <span>{prettySex(patient.sex)}</span>}

      {patient.subjectUid && (
        <span>Subject ID {patient.subjectUid}</span>
      )}
     </div>
        <div className="detail-status">
          {patient.latestSessionAt ? (
            <>Last session: {formatDateTime(patient.latestSessionAt)}</>
          ) : (
            <>No Dex session yet</>
          )}
        </div>
      </div>

{/* ── Fusion clinical significance card ───────────────────────── */}
<section className="detail-section">
  <div className="detail-card">
    {fusionLoading ? (
      <div className="empty-state-small">
        Loading fusion summary…
      </div>
    ) : fusionSummary?.fusionSummary ? (
      <>
        <div style={{ marginBottom: 12 }}>
          <strong>Care Priority:</strong>{" "}
          {fusionSummary.fusionSummary.priorityLabel}
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Clinical Significance:</strong>

          <div
            style={{
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {fusionSummary.fusionSummary.soWhat}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Signal Alignment:</strong>{" "}
          {
            fusionSummary.fusionSummary
              .signalAlignment?.interpretation
          }
        </div>

        <div
          className="muted"
          style={{
            fontSize: 12,
          }}
        >
          {
            fusionSummary.fusionSummary
              .fdaSafeDisclaimer
          }
        </div>
      </>
    ) : (
      <div className="empty-state-small">
        Fusion summary unavailable
      </div>
    )}
  </div>
</section>

{/* ── Signal Intelligence Map ─────────────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title">
    Signal Intelligence Map
  </div>

  <div className="detail-card">
    {signalGraphLoading ? (
      <div className="empty-state-small">
        Loading signal map…
      </div>
    ) : signalGraph?.nodes?.length ? (
      <>
        <div className="muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>
  This map shows how patient-reported symptoms, voice features, and physiologic
  signals relate to the current clinical context.
</div>

<div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  }}
>
  <span style={legendPill("#FEF3C7")}>Patient-reported</span>
  <span style={legendPill("#EEF2FF")}>Voice signal</span>
  <span style={legendPill("#ECFDF5")}>Physiologic signal</span>
  <span style={legendPill("#111827", "#FFFFFF")}>Fusion context</span>
</div>

<div
  style={{
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    background: "#FFFFFF",
    overflow: "hidden",
  }}
>
 <ForceGraph2D
  ref={graphRef}
  graphData={{
  nodes: signalGraph.nodes.map((node) => ({
    ...node,
    ...hubSpokePosition(node.id),
  })),
  links: signalGraph.links.map((link) => ({ ...link })),
}}
  width={820}
  height={540}
  cooldownTicks={0}
    nodeLabel={(node) =>
    `${node.label}\n\n${node.clinicalContext || ""}`
  }
  linkLabel={(link) =>
    `Relationship: ${link.label || link.relationship}`
  }
  nodeAutoColorBy="group"
  nodeRelSize={9}
  nodeVal={(node) =>
    node.group === "fusion" ? 18 : 10
  }
  linkDirectionalArrowLength={5}
  linkDirectionalArrowRelPos={1}
  linkCurvature={0.15}
 
enableZoomInteraction={false}
enablePanInteraction={false}
enableNodeDrag={false}

onNodeClick={(node) => setSelectedSignalNode(node)}
  nodeCanvasObject={(node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;

    const textWidth = ctx.measureText(label).width;
    const padding = 6 / globalScale;
    const radius = 8 / globalScale;

    ctx.fillStyle =
      node.group === "fusion"
        ? "#111827"
        : node.group === "voice_signal"
        ? "#EEF2FF"
        : node.group === "vital_signal"
        ? "#ECFDF5"
        : "#FEF3C7";

    ctx.strokeStyle =
      node.group === "fusion"
        ? "#111827"
        : "#CBD5E1";

    ctx.lineWidth = 1 / globalScale;

    const x = node.x - textWidth / 2 - padding;
    const y = node.y - fontSize / 2 - padding;
    const w = textWidth + padding * 2;
    const h = fontSize + padding * 2;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle =
      node.group === "fusion"
        ? "#FFFFFF"
        : "#111827";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, node.x, node.y);
  }}
/>
</div>

{selectedSignalNode && (
  <div
    style={{
      marginTop: 12,
      padding: 14,
      border: "1px solid #E5E7EB",
      borderRadius: 12,
      background: "#F9FAFB",
    }}
  >
    <div
      style={{
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "#64748B",
        marginBottom: 6,
        fontWeight: 700,
      }}
    >
      Selected signal
    </div>

    <div style={{ fontWeight: 700, marginBottom: 6 }}>
      {selectedSignalNode.label}
    </div>

    <div className="muted" style={{ lineHeight: 1.5 }}>
      {selectedSignalNode.clinicalContext}
    </div>
  </div>
)}

        <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          {signalGraph.fdaSafeDisclaimer}
        </div>
      </>
    ) : (
      <div className="empty-state-small">
        Signal intelligence map unavailable
      </div>
    )}
  </div>
</section>

{/* ── Temporal Signal Intelligence ───────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title">
    Temporal Signal Intelligence
  </div>

  <div className="detail-card">
    {temporalLoading ? (
      <div className="empty-state-small">
        Loading temporal signal timeline…
      </div>
    ) : temporalTimeline ? (
      <>
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 12,
            background: "#F9FAFB",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {temporalTimeline.temporalSummary.label}
          </div>

          <div className="muted" style={{ marginBottom: 8 }}>
            {temporalTimeline.temporalSummary.clinicalSignificance}
          </div>

          <div style={{ lineHeight: 1.5 }}>
            <strong>So what changed?</strong>{" "}
            {temporalTimeline.temporalSummary.soWhat}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {temporalTimeline.windows.map((window) => (
            <div
              key={window.id}
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <strong>{window.label}</strong>

                <span className="muted">
                  {formatDateTime(window.timestamp)}
                </span>
              </div>

              <div className="muted" style={{ marginBottom: 10 }}>
                {window.clinicalContext}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {window.signals.map((signal) => (
                  <span
                    key={signal.id}
                    style={legendPill(
                      signal.modality === "voice"
                        ? "#EEF2FF"
                        : signal.modality === "vitals"
                        ? "#ECFDF5"
                        : "#FEF3C7"
                    )}
                  >
                    {signal.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="muted"
          style={{
            marginTop: 12,
            fontSize: 12,
          }}
        >
          {temporalTimeline.fdaSafeDisclaimer}
        </div>
      </>
    ) : (
      <div className="empty-state-small">
        Temporal signal timeline unavailable
      </div>
    )}
  </div>
</section>

{/* ── Baseline status ───────────────────────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title">
    Baseline Status
  </div>

  <div className="detail-card">
    {!baseline ? (
      <div className="empty-state-small">
        Loading baseline…
      </div>
    ) : (
      <>
        <div style={{ marginBottom: 8 }}>
          <strong>Status:</strong>{" "}
          {baseline.baselineStatus === "voice_baseline_ready"
            ? "✓ Voice baseline ready"
            : baseline.baselineStatus === "multimodal_baseline_ready"
            ? "✓ Multimodal baseline ready"
            : baseline.baselineStatus === "wearable_enabled"
            ? "✓ Wearable connected"
            : "Voice-only monitoring"}
        </div>

        <div className="muted">
          Wearable:{" "}
          {baseline.wearableConnected
            ? "Connected"
            : "Not connected"}
        </div>

        {baseline.voiceBaseline?.exists && (
  <>
    <button
      className="btn-text"
      style={{
        padding: 0,
        border: "none",
        background: "transparent",
      }}
      onClick={() =>
        setShowBaselineDetails(!showBaselineDetails)
      }
    >
      Voice baseline: Available{" "}
      {showBaselineDetails ? "▲" : "▼"}
    </button>

    {showBaselineDetails && (
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <div className="muted">
          <strong>Baseline established:</strong>{" "}
          {formatDateTime(
            baseline.voiceBaseline.latestBaselineAt
          )}
        </div>

        <div className="muted">
          <strong>Protocol:</strong>{" "}
          {baseline.voiceBaseline.protocol ||
            "voice-baseline-v2-en"}
        </div>

        <div style={{ marginTop: 10 }}>
          <strong>Tasks completed</strong>

          <div className="muted">
            ✓ Standardized reading
          </div>

          <div className="muted">
            ✓ Guided speech
          </div>

          <div className="muted">
            ✓ Sustained vowel
          </div>

          <div className="muted">
            ✓ Counting task
          </div>
        </div>

       <div
  style={{
    marginTop: 10,
    fontWeight: 600,
  }}
>
  Ready for longitudinal comparison
</div>

{baseline.voiceFeatures && (
  <div
    style={{
      marginTop: 16,
      paddingTop: 12,
      borderTop: "1px solid #E5E7EB",
    }}
  >
    <div
      style={{
        fontWeight: 600,
        marginBottom: 8,
      }}
    >
      Voice Feature Metadata
    </div>

    <div className="muted">
      <strong>Feature files:</strong>{" "}
      {baseline.voiceFeatures.count ?? 0}
    </div>

    <div className="muted">
  <strong>Latest file:</strong>{" "}
  {baseline.voiceFeatures.latest?.key
    ? baseline.voiceFeatures.latest.key.split("/").pop()
    : "Not available"}
</div>

<div className="muted">
  <strong>Latest extracted:</strong>{" "}
  {baseline.voiceFeatures.latest?.lastModified
    ? formatDateTime(baseline.voiceFeatures.latest.lastModified)
    : "Not available"}
</div>

{voiceDeviation && (
  <div
    style={{
      marginTop: 16,
      padding: 12,
      border: "1px solid #E5E7EB",
      borderRadius: 10,
      background: "#F9FAFB",
    }}
  >
    <div
      style={{
        fontWeight: 700,
        marginBottom: 4,
      }}
    >
      Voice Deviation Intelligence
    </div>

    <div className="muted" style={{ marginBottom: 8 }}>
  {getDeviationSummary(voiceDeviation)}
</div>

<div className="muted" style={{ marginBottom: 8 }}>
  Voice-only monitoring active. Interpret alongside reported symptoms and physiologic signals when available.
</div>

    <div className="muted">
      <strong>Overall deviation:</strong>{" "}
      {getSeverityIcon(voiceDeviation.deviationLevel)}{" "}
      {titleCase(voiceDeviation.deviationLevel)}
    </div>

    <div className="muted">
      <strong>Compared at:</strong>{" "}
      {voiceDeviation.comparedAt
        ? formatDateTime(voiceDeviation.comparedAt)
        : "Not available"}
    </div>

    {voiceDeviation.features?.map((feature) => (
  <div
    key={feature.metric}
    className="muted"
    style={{
      padding: "8px 0",
      borderTop: "1px solid #E5E7EB",
      marginTop: 6,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span>{feature.label}</span>

      <span>
        {getSeverityIcon(feature.severity)}{" "}
        {titleCase(feature.severity)}
        {feature.direction !== "stable" && (
  <>
    {" "}· {titleCase(feature.direction)}
  </>
)}
{" "}· {formatPercent(feature.percentChange)}
      </span>
    </div>

    {feature.severity !== "stable" && (
  <div
    style={{
      marginTop: 3,
      fontSize: 13,
    }}
  >
    {getFeatureInterpretation(feature)}
  </div>
)}
  </div>
))}
  </div>
)}
  </div>
)}
      </div>
    )}
  </>
)}
      </>
    )}
  </div>
</section> 
     {/* ── What patient reported (filtered entities) ────────────────────── */}
      <section className="detail-section">
        <div className="detail-section-title">What this patient reported</div>

        {buckets.length === 0 ? (
          <div className="empty-state-small">
            No clinical entities extracted from the most recent session.
          </div>
        ) : (
          <div className="detail-card">
            {buckets.map(({ key, label, items }) => (
              <div key={key} className="detail-bucket">
                <div className="detail-bucket-label">{label}</div>
                <div className="detail-bucket-tags">
                  {items.map((e, i) => (
                    <span
                      key={i}
                      className={`entity-tag entity-${classForCategory(key)}`}
                    >
                      {e.text}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Vitals (placeholder until Validic is live) ───────────────────── */}
      <section className="detail-section">
        <div className="detail-section-title">Vitals</div>
        <div className="detail-card">
          {vitals && vitals.length > 0 ? (
            <VitalsTable vitals={vitals} />
          ) : (
            <div className="empty-state-small">
              No wearable connected.
              <span className="muted-inline">
                {" "}Voice-only monitoring active
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── Transcript toggle ─────────────────────────────────────────────── */}
      <section className="detail-section">
        <div className="detail-section-title-row">
          <div className="detail-section-title">Conversation transcript</div>
          {patient.latestSessionId && (
            <button
              className="btn-secondary-small"
              onClick={handleToggleTranscript}
              disabled={transcriptLoading}
            >
              {transcriptLoading
                ? "Loading…"
                : showTranscript
                ? "Hide"
                : "Show transcript"}
            </button>
          )}
        </div>

        {transcriptError && (
          <div className="banner-error">{transcriptError}</div>
        )}

        {showTranscript && transcript && (
          <div className="detail-card">
            <div className="transcript-meta">
              {formatDateTime(transcript.capturedAt)} ·{" "}
              {transcript.messages.length} messages
            </div>
            <div className="transcript">
              {transcript.messages.map((m, i) => (
                <div
                  key={i}
                  className={`transcript-msg transcript-msg-${
                    m.role === "user" ? "patient" : "dex"
                  }`}
                >
                  <div className="transcript-role">
                    {m.role === "user" ? "Patient" : "Dex"}
                  </div>
                  <div className="transcript-content">{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function VitalsTable({ vitals }) {
  return (
    <table className="vitals-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Value</th>
          <th>When</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {vitals.slice(0, 20).map((v, i) => (
          <tr key={i}>
            <td>{prettyVitalType(v.type)}</td>
            <td>
              {v.value} {v.unit}
            </td>
            <td>{formatDateTime(v.timestamp)}</td>
            <td className="muted">{v.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function prettySex(s) {
  return {
    F: "Female", M: "Male",
    female: "Female", male: "Male",
    nonbinary: "Non-binary",
    prefer_not_to_say: "Not specified",
  }[s] || s;
}

function prettyVitalType(t) {
  return {
    heart_rate: "Heart rate",
    hrv: "HRV",
    sleep_duration: "Sleep",
    steps: "Steps",
    blood_pressure_systolic: "BP (systolic)",
    blood_pressure_diastolic: "BP (diastolic)",
    glucose: "Glucose",
    weight: "Weight",
    oxygen_saturation: "SpO₂",
    body_temperature: "Body temp",
    respiratory_rate: "Resp rate",
  }[t] || t;
}

function hubSpokePosition(id) {
  const positions = {
    fusion_context: {
      x: 0,
      y: 0,
      fx: 0,
      fy: 0,
    },

    patient_reported_fever: {
      x: 0,
      y: -175,
      fx: 0,
      fy: -175,
    },

    tachycardia: {
      x: 210,
      y: -20,
      fx: 210,
      fy: -20,
    },

    respiratory_rate: {
      x: 170,
      y: 120,
      fx: 170,
      fy: 120,
    },

    speech_tempo: {
      x: -210,
      y: -20,
      fx: -210,
      fy: -20,
    },

    pause_burden: {
      x: -170,
      y: 120,
      fx: -170,
      fy: 120,
    },
  };

  return positions[id] || {};
}

function legendPill(background, color = "#111827") {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    background,
    color,
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #E5E7EB",
  };
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
function getPatientAge(patient) {
  if (patient.age) return patient.age;

  if (patient.dob) {
    return Math.floor(
      (Date.now() - new Date(patient.dob)) / 31557600000
    );
  }

  return null;
}
