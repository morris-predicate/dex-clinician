import React, { useRef, useCallback, useMemo } from "react";
import { useEffect, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import ForceGraph2D from "react-force-graph-2d";
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

// ─── Time-Aligned Insights ──────────────────────────────────────────────────
function TimeAlignedInsights({ vitals, voiceDeviation, baseline, patient, }) {
  const [timeWindow, setTimeWindow] = useState("1h");
  const [activeParams, setActiveParams] = useState(["HR", "HRV", "RR", "SpO2", "Temp"]);
  const [draggingParam, setDraggingParam] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const ALL_PARAMS = useMemo(() => [
  {
    id: "HR",
    label: "Heart Rate",
    unit: "bpm",
    color: "#EF4444",
    vitalType: "heart_rate",
    yAxis: 0,
    shortLabel: "HR",
  },
  {
    id: "HRV",
    label: "Heart Rate Variability",
    unit: "ms",
    color: "#14B8A6",
    vitalType: "hrv_sdnn",
    yAxis: 0,
    shortLabel: "HRV",
  },
  {
    id: "RR",
    label: "Resp. Rate",
    unit: "br/min",
    color: "#06B6D4",
    vitalType: "respiratory_rate",
    yAxis: 0,
    shortLabel: "RR",
  },
  {
    id: "SpO2",
    label: "SpO₂",
    unit: "%",
    color: "#8B5CF6",
    vitalType: "spo2",
    yAxis: 1,
    shortLabel: "SpO₂",
  },
  {
    id: "Temp",
    label: "Temperature",
    unit: "°C",
    color: "#F59E0B",
    vitalType: "wrist_temperature",
    yAxis: 1,
    shortLabel: "Temp",
  },
], []);

  const windowMs = useMemo(
    () => ({ "1h": 1, "6h": 6, "12h": 12, "24h": 24, "7d": 168 }[timeWindow] * 3600 * 1000),
    [timeWindow]
  );

  // Stable demo data so the chart looks populated when no wearable is connected
  const getDemoData = useCallback((paramId, endTime, wMs) => {
    const sequences = {
      HR:   [72, 75, 78, 83, 115, 118, 93, 84],
      RR:   [16, 16, 17, 18,  24,  24, 22, 21],
      SpO2: [97, 97, 97, 97,  97,  97, 97, 97],
      Temp: [37.0, 37.0, 37.1, 37.2, 37.2, 37.2, 37.1, 37.1],
    };
    const vals = sequences[paramId] || Array(8).fill(70);
    const step = wMs / (vals.length - 1);
    return vals.map((v, i) => [endTime - wMs + i * step, v]);
  }, []);

 const now = useMemo(() => {
  const latestVitalTime = Math.max(
    ...((vitals || [])
      .map((v) => new Date(v.timestamp).getTime())
      .filter((t) => Number.isFinite(t)))
  );

  return Number.isFinite(latestVitalTime)
    ? latestVitalTime
    : Date.now();
}, [vitals]);

  const mainSeries = useMemo(() => {
    return ALL_PARAMS
      .filter(p => activeParams.includes(p.id))
      .map(param => {
        const rawData = (vitals || [])
  .filter((v) => {
    const t = new Date(v.timestamp).getTime();

    return (
      v.type === param.vitalType &&
      Number.isFinite(t) &&
      t >= now - windowMs &&
      t <= now
    );
  })
  .map((v) => [
    new Date(v.timestamp).getTime(),
    parseFloat(v.value),
  ])
  .sort((a, b) => a[0] - b[0]);

        const hasAnyRealVitals =
  (vitals || []).length > 0;

const isDemo =
  rawData.length === 0 && !hasAnyRealVitals;

const data = isDemo
  ? getDemoData(param.id, now, windowMs)
  : rawData;

        return {
          name: `${param.shortLabel} (${param.unit})`,
          data,
          color: param.color,
          yAxis: param.yAxis,
          type: data.length < 2 ? "scatter" : "spline",
          lineWidth: data.length < 2 ? 0 : 2,
          dashStyle:
  	    isDemo
              ? "Dash"
              : data.length < 5
              ? "ShortDash"
              : "Solid",
          marker: { enabled: true, radius: 4, symbol: "circle" },
        };
      });
  }, [ALL_PARAMS, activeParams, vitals, windowMs, now, getDemoData]);

  // VDI ──────────────────────────────────────────────────────────────────────
  const VDI_SCORES = { stable: 8, mild: 38, moderate: 62, significant: 88 };
  const VDI_COLORS = { stable: "#22C55E", mild: "#EAB308", moderate: "#F97316", significant: "#EF4444" };

  const hasVdiData = !!voiceDeviation?.compared;

  const vdiBarData = useMemo(() => {
    if (!hasVdiData) return null;
    if (voiceDeviation?.features?.length) {
      return voiceDeviation.features.map(f => ({
        name: f.label || f.metric,
        y:     VDI_SCORES[f.severity] ?? 8,
        color: VDI_COLORS[f.severity] ?? "#22C55E",
      }));
    }
    const lvl = voiceDeviation?.deviationLevel || "stable";
    return [{ name: "Overall VDI", y: VDI_SCORES[lvl] ?? 8, color: VDI_COLORS[lvl] ?? "#22C55E" }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceDeviation, hasVdiData]);

  // Highcharts options ────────────────────────────────────────────────────────
const voiceCaptureEvents = useMemo(() => {
  const latestSessionAt = patient?.latestSessionAt;

  const hasVoiceCapture =
    patient?.latestSessionId &&
    voiceDeviation?.compared &&
    patient?.latestEntities?.length;

  if (!hasVoiceCapture || !latestSessionAt) {
    return [];
  }

  const t = new Date(latestSessionAt).getTime();

  if (
    !Number.isFinite(t) ||
    t < now - windowMs ||
    t > now
  ) {
    return [];
  }

  return [
    {
      time: t,
      label: "Voice capture event",

      symptoms:
        patient?.latestEntities
          ?.filter(
            (e) => e.category === "MEDICAL_CONDITION"
          )
          ?.map((e) => e.text) || [],

      voiceSignals:
        voiceDeviation?.features
          ?.filter(
            (f) => f.severity !== "stable"
          )
          ?.map((f) => f.label) || [],
    },
  ];
}, [patient, voiceDeviation, now, windowMs]);
  const mainChartOptions = useMemo(() => ({
    chart: {
      type: "spline",
      backgroundColor: "#0F172A",
      plotBackgroundColor: "#0F172A",
      style: { fontFamily: "inherit" },
      height: 280,
      marginRight: 80,
      animation: false,
    },
    title: { text: null },
    credits: { enabled: false },
    legend: {
      enabled: true,
      itemStyle: { color: "#94A3B8", fontSize: "11px" },
      itemHoverStyle: { color: "#FFFFFF" },
    },
    xAxis: {
  type: "datetime",
  gridLineColor: "#1E293B",
  lineColor: "#334155",
  tickColor: "#334155",
  labels: {
    style: { color: "#64748B", fontSize: "11px" },
    format: "{value:%H:%M}",
  },
 plotLines: voiceCaptureEvents.map((event) => ({
  value: event.time,
  color: "#22C55E",
  width: 1,
  dashStyle: "ShortDash",
  zIndex: 10,

  label: {
    useHTML: true,
    text: `
      <div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:4px;
      ">
        <div style="
          width:10px;
          height:10px;
          border-radius:999px;
          background:#22C55E;
          border:2px solid #0F172A;
          box-shadow:0 0 0 2px rgba(34,197,94,.25);
        "></div>

        <div style="
          color:#22C55E;
          font-size:10px;
          font-weight:600;
          white-space:nowrap;
        ">
          Voice capture
        </div>
      </div>
    `,
    rotation: 0,
    y: 18,
  },
})),
},
    yAxis: [
      {
        title: { text: "HR / RR", style: { color: "#64748B", fontSize: "11px" } },
        gridLineColor: "#1E293B",
        labels: { style: { color: "#64748B", fontSize: "11px" } },
        min: 0,
      },
      {
        title: { text: "SpO₂ / Temp", style: { color: "#64748B", fontSize: "11px" } },
        gridLineColor: "#1E293B",
        labels: { style: { color: "#64748B", fontSize: "11px" } },
        opposite: true,
        min: 0,
      },
    ],
    tooltip: {
  backgroundColor: "#1E293B",
  borderColor: "#334155",
  style: { color: "#F8FAFC" },
  xDateFormat: "%H:%M",
  shared: false,

  positioner: function (labelWidth, labelHeight, point) {
    return {
      x: Math.min(
        point.plotX + 180,
        this.chart.chartWidth - labelWidth - 20
      ),
      y: Math.max(point.plotY - 80, 20),
    };
  },
},
    plotOptions: {
      spline: { marker: { enabled: true, radius: 4 } },
    },
    series: [
  ...mainSeries,
  {
    name: "Voice capture event",
    type: "scatter",
    data: voiceCaptureEvents.map((event) => ({
      x: event.time,
      y:
  mainSeries?.[0]?.data?.length
    ? mainSeries[0].data[
        Math.floor(mainSeries[0].data.length / 2)
      ]?.[1] ?? 0
    : 0,
      label: event.label,
      symptoms: event.symptoms,
      voiceSignals: event.voiceSignals,
    })),
    yAxis: 0,
    color: "#22C55E",
    marker: {
      enabled: true,
      radius: 6,
      symbol: "circle",
      lineWidth: 2,
      lineColor: "#0F172A",
    },
tooltip: {
  headerFormat: "",
  useHTML: true,

  pointFormatter: function () {
    const eventTime = Highcharts.dateFormat(
      "%l:%M %p",
      this.x
    );

    const symptoms = this.symptoms?.length
      ? this.symptoms
      : ["None recorded"];

    const voiceSignals = this.voiceSignals?.length
      ? this.voiceSignals
      : ["Not available"];

    return `
  <b>Patient Symptom Report</b>
  <span style="color:#94A3B8;font-weight:500;"> ${eventTime}</span>
  <br/><br/>
  <span style="color:#94A3B8;font-size:12px;font-weight:700;">
    Patient Reported Symptom(s):
  </span>
  <br/>
  ${symptoms.map((s) => `• ${s}`).join("<br/>")}
  <br/><br/>
  <span style="color:#94A3B8;font-size:12px;font-weight:700;">
    Voice Signal Context:
  </span>
  <br/>
  ${voiceSignals.map((s) => `• ${s}`).join("<br/>")}
`;
  },
},
}, // closes scatter series
], // closes series array
}), [mainSeries, voiceCaptureEvents]);

  const vdiChartOptions = useMemo(() => ({
    chart: {
      type: "bar",
      backgroundColor: "#0F172A",
      style: { fontFamily: "inherit" },
      height: 170,
      marginRight: 80,
      animation: false,
    },
    title: {
      text: "Voice Deviation Index (VDI)",
      style: { color: "#94A3B8", fontSize: "12px", fontWeight: "700" },
      align: "left",
      margin: 12,
    },
    subtitle: {
      text: "Per-feature deviation from voice baseline · descriptive only",
      style: { color: "#64748B", fontSize: "10px" },
      align: "left",
    },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      categories: vdiBarData?.map(d => d.name) || [],
      labels: { style: { color: "#64748B", fontSize: "10px" } },
      lineColor: "#334155",
      tickColor: "#334155",
    },
    yAxis: {
      title: { text: "Score", style: { color: "#64748B", fontSize: "10px" } },
      gridLineColor: "#1E293B",
      labels: { style: { color: "#64748B", fontSize: "10px" } },
      max: 100,
      min: 0,
      plotBands: [
        { from: 0,  to: 20,  color: "rgba(34,197,94,0.06)"  },
        { from: 20, to: 50,  color: "rgba(234,179,8,0.06)"  },
        { from: 50, to: 75,  color: "rgba(249,115,22,0.06)" },
        { from: 75, to: 100, color: "rgba(239,68,68,0.06)"  },
      ],
    },
    tooltip: {
      backgroundColor: "#1E293B",
      borderColor: "#334155",
      style: { color: "#F8FAFC" },
      formatter() { return `<b>${this.point.name}</b>: ${this.y} / 100`; },
    },
    series: [{
      name: "VDI",
      data: vdiBarData || [],
      colorByPoint: true,
      dataLabels: {
        enabled: true,
        style: { color: "#CBD5E1", fontSize: "10px", textOutline: "none" },
      },
    }],
  }), [vdiBarData]);

  // Drag handlers ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((id) => setDraggingParam(id), []);
  const handleDragEnd   = useCallback(() => setDraggingParam(null), []);
  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    setDraggingParam(prev => {
      if (prev) setActiveParams(ap => ap.includes(prev) ? ap : [...ap, prev]);
      return null;
    });
  }, []);
  const removeParam = useCallback((id) => setActiveParams(ap => ap.filter(x => x !== id)), []);

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).replace(/\s/g, "-");

  const hasDemo = mainSeries.some(s => s.dashStyle === "Dash");

  return (
    <div style={{
      border: "1px solid #1E293B",
      borderRadius: 14,
      overflow: "hidden",
      background: "#0F172A",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        padding: "14px 18px 12px", borderBottom: "1px solid #1E293B",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#F8FAFC" }}>
              Time-Aligned Insights
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
            Temporal relationships across multiple data streams – descriptive only
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Window buttons */}
          <div style={{ display: "flex", gap: 3 }}>
            {["1h", "6h", "12h", "24h", "7d"].map(w => (
              <button key={w} onClick={() => setTimeWindow(w)} style={{
                padding: "3px 9px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: timeWindow === w ? "#3B82F6" : "#334155",
                background: timeWindow === w ? "rgba(59,130,246,0.15)" : "transparent",
                color: timeWindow === w ? "#60A5FA" : "#64748B",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
                {w}
              </button>
            ))}
          </div>
          <span style={{ color: "#334155", fontSize: 12 }}>|</span>
          <span style={{ fontSize: 11, color: "#475569" }}>{dateLabel}</span>
        </div>
      </div>

      {/* ── Body: sidebar + chart drop zone ── */}
      <div style={{ display: "flex" }}>

        {/* Parameter sidebar */}
        <div style={{
          width: 136, flexShrink: 0,
          borderRight: "1px solid #1E293B",
          padding: "12px 10px",
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "#334155",
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6,
          }}>
            Physio Params
          </div>
          <div style={{ fontSize: 9, color: "#334155", marginBottom: 10, lineHeight: 1.4 }}>
            Drag onto chart to visualize
          </div>

          {ALL_PARAMS.map(param => {
            const isActive = activeParams.includes(param.id);
            return (
              <div
                key={param.id}
                draggable={!isActive}
                onDragStart={() => handleDragStart(param.id)}
                onDragEnd={handleDragEnd}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "5px 7px", borderRadius: 8, marginBottom: 5,
                  border: `1px solid ${isActive ? param.color + "55" : "#1E293B"}`,
                  background: isActive ? param.color + "18" : "#0D1421",
                  cursor: isActive ? "default" : "grab",
                  transition: "all 0.12s",
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: param.color, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, lineHeight: 1.2,
                    color: isActive ? "#E2E8F0" : "#475569",
                    fontWeight: isActive ? 600 : 400,
                  }}>
                    {param.shortLabel}
                  </div>
                  <div style={{ fontSize: 9, color: "#334155" }}>{param.unit}</div>
                </div>
                {isActive && (
                  <button
                    onClick={() => removeParam(param.id)}
                    title="Remove"
                    style={{
                      background: "none", border: "none", color: "#475569",
                      cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1, flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Chart drop zone */}
        <div
          style={{ flex: 1, position: "relative", minWidth: 0 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(59,130,246,0.08)",
              border: "2px dashed #3B82F6",
              zIndex: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#60A5FA", fontWeight: 600, fontSize: 13,
              pointerEvents: "none",
            }}>
              Drop to add to chart
            </div>
          )}
          {activeParams.length === 0 ? (
            <div style={{
              height: 280,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#334155", fontSize: 13,
            }}>
              Drag a parameter from the left to begin
            </div>
          ) : (
            <HighchartsReact highcharts={Highcharts} options={mainChartOptions} />
          )}
        </div>
      </div>

      {/* ── VDI sub-chart ── */}
      <div style={{ borderTop: "1px solid #1E293B" }}>
        {hasVdiData && vdiBarData ? (
          <div style={{ paddingLeft: 136 }}>
            <HighchartsReact highcharts={Highcharts} options={vdiChartOptions} />
          </div>
        ) : (
          <div style={{
            padding: "12px 18px 12px 154px",
            color: "#334155", fontSize: 12,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>🎤</span>
            <span>
              <strong style={{ color: "#475569" }}>Voice Deviation Index (VDI):</strong>{" "}
              {baseline?.voiceBaseline?.exists
                ? "Baseline established — longitudinal VDI will appear here after additional voice captures."
                : "Voice baseline required to compute VDI."}
            </span>
          </div>
        )}
      </div>

      {/* ── Footer legend ── */}
      <div style={{
        padding: "8px 18px 12px 154px",
        borderTop: "1px solid #1E293B",
        display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center",
      }}>
        <span style={{ fontSize: 10, color: "#334155" }}>VDI key:</span>
        {[
          { label: "Stable",      color: "#22C55E" },
          { label: "Mild",        color: "#EAB308" },
          { label: "Moderate",    color: "#F97316" },
          { label: "Significant", color: "#EF4444" },
        ].map(item => (
          <span key={item.label} style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 10, color: "#475569",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: item.color, flexShrink: 0,
            }} />
            {item.label}
          </span>
        ))}
        {hasDemo && (
          <span style={{ fontSize: 10, color: "#334155", marginLeft: 8 }}>
            — Dashed lines = demo data (no wearable connected)
          </span>
        )}
      </div>
    </div>
  );
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
  const [showBaselineStatus, setShowBaselineStatus] = useState(false);

  const [showTemporalTrajectory, setShowTemporalTrajectory] = useState(false);
  const [showReportedDetails, setShowReportedDetails] = useState(false);

  const [fusionSummary, setFusionSummary] = useState(null);
  const [fusionLoading, setFusionLoading] = useState(false);

  const [signalGraph, setSignalGraph] = useState(null);
  const [signalGraphLoading, setSignalGraphLoading] = useState(false);
  const [selectedSignalNode, setSelectedSignalNode] = useState(null);

  const [temporalTimeline, setTemporalTimeline] = useState(null);
  const [temporalLoading, setTemporalLoading] = useState(false);

  const [currentSignalInsight, setCurrentSignalInsight] = useState(null);
  const [currentSignalInsightLoading, setCurrentSignalInsightLoading] = useState(false);

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
  loadCurrentSignalInsight(patientData);
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

async function loadCurrentSignalInsight(patientData) {
  const subjectUid =
    patientData?.subjectUid ||
    patientData?.patient?.subjectUid;

  if (!subjectUid) {
    setCurrentSignalInsight(null);
    return;
  }

  setCurrentSignalInsightLoading(true);

  try {
    const res = await fetch(
      `https://dex-proxy-production.up.railway.app/api/signals/current?subjectUid=${encodeURIComponent(subjectUid)}`,
      {
        headers: {
          "X-Clinician-Key": clinicianKey,
        },
      }
    );

    const data = await res.json();

    if (data?.ok) {
      setCurrentSignalInsight(data);
    } else {
      setCurrentSignalInsight(null);
    }
  } catch (err) {
    console.error("Current signal insight failed:", err);
    setCurrentSignalInsight(null);
  } finally {
    setCurrentSignalInsightLoading(false);
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

const currentReviewWindow =
  temporalTimeline?.windows?.find(
    (window) => window.id === "current_window"
  ) || null;

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
  <div className="detail-card care-priority-card">
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

{/* ── Time-Aligned Insights ─────────────────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title">
    Time-Aligned Insights
  </div>
  <TimeAlignedInsights
  vitals={vitals}
  voiceDeviation={voiceDeviation}
  baseline={baseline}
  patient={patient}
/>
</section>

{/* ── Fusion Signal Intelligence ───────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title">
    Fusion Signal Intelligence
  </div>

  <div className="detail-card">
    {currentSignalInsightLoading ? (
      <div className="empty-state-small">
        Loading signal intelligence…
      </div>
    ) : currentSignalInsight?.overallStatus ? (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <div>
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#64748B",
                  fontWeight: 800,
                  marginBottom: 6,
                }}
              >
                Clinical synthesis
              </div>

              <div
  style={{
    fontWeight: 800,
    fontSize: 17,
    marginBottom: 6,
  }}
>
  {currentSignalInsight.overallStatus.fusionScore?.evidenceCount > 0
    ? currentSignalInsight.overallStatus.clinician?.review
        ?.primaryFinding
    : "No convergent signal drift detected in the current review window."}
</div>

              <div className="muted" style={{ lineHeight: 1.55 }}>
  {currentSignalInsight.overallStatus.fusionScore?.evidenceCount > 0
    ? currentSignalInsight.overallStatus.clinician?.review
        ?.confidenceRationale
    : "Current physiologic and voice-pattern signals are close to the recent baseline. Continue trending longitudinal changes and compare with patient-reported symptoms."}
</div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={signalShiftPill({ severity: "mild" })}>
                Confidence:{" "}
                {titleCase(
                  currentSignalInsight.overallStatus.fusionScore?.confidence
                )}
              </span>

              <span style={signalShiftPill({ severity: "mild" })}>
                Persistence:{" "}
                {titleCase(
                  currentSignalInsight.overallStatus.temporalContext?.summary
                    ?.persistence
                )}
              </span>

              <span style={signalShiftPill({ severity: "mild" })}>
                Pattern:{" "}
                {titleCase(
                  currentSignalInsight.overallStatus.temporalContext?.summary
                    ?.pattern
                )}
              </span>

              <span style={signalShiftPill({ severity: "mild" })}>
                Convergence:{" "}
                {currentSignalInsight.overallStatus.fusionScore
                  ?.crossDomainConvergence
                  ? "Cross-domain"
                  : "Single-domain"}
              </span>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 14,
              overflow: "hidden",
              background: "#0F172A",
              minHeight: 210,
            }}
          >
            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: {
                  type: "bar",
                  backgroundColor: "#0F172A",
                  height: 220,
                  animation: false,
                  style: { fontFamily: "inherit" },
                },
                title: {
                  text: "Signal Contribution",
                  align: "left",
                  style: {
                    color: "#CBD5E1",
                    fontSize: "13px",
                    fontWeight: "700",
                  },
                },
                credits: { enabled: false },
                legend: { enabled: false },
                xAxis: {
                  categories:
                    currentSignalInsight.overallStatus.signalEvidence?.map(
                      (s) => s.label
                    ) || [],
                  labels: {
                    style: { color: "#94A3B8", fontSize: "11px" },
                  },
                  lineColor: "#334155",
                  tickColor: "#334155",
                },
                yAxis: {
                  min: 0,
                  max: 1,
                  title: {
                    text: "Relative contribution",
                    style: { color: "#64748B", fontSize: "10px" },
                  },
                  labels: {
                    style: { color: "#64748B", fontSize: "10px" },
                  },
                  gridLineColor: "#1E293B",
                },
                tooltip: {
                  backgroundColor: "#1E293B",
                  borderColor: "#334155",
                  style: { color: "#F8FAFC" },
                  pointFormatter: function () {
                    return `<b>${this.category}</b><br/>Contribution: ${Number(
                      this.y
                    ).toFixed(2)} / 1.00`;
                  },
                },
                series: [
                  {
                    name: "Contribution",
                    data:
                      currentSignalInsight.overallStatus.signalEvidence?.map(
                        (s) => Number(s.score || 0)
                      ) || [],
                    color: "#38BDF8",
                    dataLabels: {
                      enabled: true,
                      style: {
                        color: "#CBD5E1",
                        fontSize: "10px",
                        textOutline: "none",
                      },
                    },
                  },
                ],
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            What changed together?
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {currentSignalInsight.overallStatus.signalEvidence?.length ? (
              currentSignalInsight.overallStatus.signalEvidence.map(
                (signal) => (
                  <div
                    key={signal.signal}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "9px 11px",
                      borderRadius: 10,
                      background: "#F8FAFC",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {signal.label}
                      </div>
                      <div
                        className="muted"
                        style={{ fontSize: 12, marginTop: 2 }}
                      >
                        {signal.explanation}
                      </div>
                    </div>

                    <div
                      className="muted"
                      style={{
                        fontSize: 12,
                        textAlign: "right",
                        minWidth: 120,
                      }}
                    >
                      {titleCase(signal.magnitude)} ·{" "}
                      {titleCase(signal.direction)}
                    </div>
                  </div>
                )
              )
            ) : (
              <div className="empty-state-small">
                No changed signal evidence detected.
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            background: "#F8FAFC",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            Clinical actionability
          </div>

          <div className="muted" style={{ lineHeight: 1.55 }}>
            {
  currentSignalInsight.overallStatus.clinician?.review
    ?.recommendedReview ||
    "Continue longitudinal monitoring and correlate with patient-reported symptoms."
}
          </div>

          <div className="muted" style={{ marginTop: 8, lineHeight: 1.55 }}>
            {
              currentSignalInsight.overallStatus.temporalContext?.summary
                ?.interpretation
            }
          </div>
        </div>

        <div
          className="muted"
          style={{
            marginTop: 12,
            fontSize: 12,
          }}
        >
          {currentSignalInsight.disclaimer ||
            "Descriptive signal intelligence only. Not diagnostic."}
        </div>
      </>
    ) : (
      <div className="empty-state-small">
        Signal intelligence unavailable
      </div>
    )}
  </div>
</section>
{/* ── Current Review Window ───────────────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title">
    Current Review Window
  </div>

  <div
    className="detail-card"
    style={{
  border: "1px solid #BFDBFE",
  background: "#F0F7FF",
}}
  >
    {temporalLoading ? (
      <div className="empty-state-small">
        Loading current review window…
      </div>
    ) : currentReviewWindow?.signals?.length ? (
      <>
        <div className="muted" style={{ marginBottom: 10 }}>
          {currentReviewWindow.clinicalContext}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {currentReviewWindow.signals.map((signal) => (
            <span
              key={signal.id}
              style={signalShiftPill(signal)}
              title={signal.interpretation}
            >
              {signal.label}

              {signal.percentChange !== undefined && (
                <>
                  {" "}
                  {signal.percentChange > 0 ? "↑" : "↓"}
                  {Math.abs(signal.percentChange)}%
                </>
              )}

              {signal.severity && (
                <>
                  {" "}·{" "}
                  {signal.severity === "new"
                    ? "New finding"
                    : titleCase(signal.severity)}
                </>
              )}
            </span>
          ))}
        </div>
      </>
    ) : (
      <div className="empty-state-small">
        Current review window unavailable
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
  width={window.innerWidth - 120}
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
  node.group === "fusion" ? 24 : 10
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
  <div className="detail-section-title-row">
  <div className="detail-section-title">
    Temporal Signal Trajectory
  </div>

  <button
    className="btn-secondary-small"
    onClick={() => setShowTemporalTrajectory(!showTemporalTrajectory)}
    type="button"
  >
    {showTemporalTrajectory ? "Hide" : "Show"}
  </button>
</div>

  {showTemporalTrajectory && (
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
          <div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  }}
>
  <span style={trajectoryBadge(temporalTimeline.temporalSummary)}>
    {temporalTimeline.temporalSummary.trajectoryLabel ||
      temporalTimeline.temporalSummary.label}
  </span>

  <span style={agreementBadge(temporalTimeline.temporalSummary)}>
    {temporalTimeline.temporalSummary.agreementLabel ||
      "Signal agreement available"}
  </span>
{temporalTimeline.temporalSummary.velocityLabel && (
  <span style={velocityBadge(temporalTimeline.temporalSummary)}>
    {temporalTimeline.temporalSummary.velocityLabel}
{" "} -{" "}
{titleCase(
  temporalTimeline.temporalSummary.velocityLevel
)}
  </span>
)}
</div>

<div className="muted" style={{ marginBottom: 8 }}>
  {temporalTimeline.temporalSummary.trajectoryContext ||
    temporalTimeline.temporalSummary.clinicalSignificance}
</div>

{temporalTimeline.temporalSummary.velocityContext && (
  <div className="muted" style={{ marginBottom: 8 }}>
    {temporalTimeline.temporalSummary.velocityContext}
  </div>
)}

<div style={{ lineHeight: 1.5 }}>
  <strong>So what changed?</strong>{" "}
  {temporalTimeline.temporalSummary.soWhat}
</div>

{temporalTimeline.temporalSummary.confidenceLabel && (
  <div
    style={{
      marginTop: 12,
      paddingTop: 12,
      borderTop: "1px solid #E5E7EB",
    }}
  >
    <div style={{ marginBottom: 8 }}>
      <span style={confidenceBadge(temporalTimeline.temporalSummary)}>
        {temporalTimeline.temporalSummary.confidenceLabel}
      </span>
    </div>

    <div className="muted" style={{ marginBottom: 8 }}>
      {temporalTimeline.temporalSummary.confidenceContext}
    </div>

    <div style={{ display: "grid", gap: 6 }}>
  {temporalTimeline.temporalSummary.confidenceDrivers
    ?.filter((d) => d.type === "positive")
    .map((driver) => (
      <div
        key={driver.label}
        className="muted"
        style={{
          fontSize: 13,
          color: "#166534",
        }}
      >
        ✓ {driver.label}
      </div>
    ))}

  {temporalTimeline.temporalSummary.confidenceDrivers
    ?.filter((d) => d.type === "limitation")
    .map((driver) => (
      <div
        key={driver.label}
        className="muted"
        style={{
          fontSize: 13,
          color: "#9A3412",
        }}
      >
        ⚠ {driver.label}
      </div>
    ))}
</div>
  </div>
)}

{temporalTimeline.temporalSummary.topContributingSignals?.length > 0 && (
  <div
    style={{
      marginTop: 12,
      paddingTop: 12,
      borderTop: "1px solid #E5E7EB",
    }}
  >
    <div
      style={{
        fontWeight: 700,
        marginBottom: 8,
      }}
    >
      Top Contributing Signals
    </div>

    <div style={{ display: "grid", gap: 8 }}>
      {temporalTimeline.temporalSummary.topContributingSignals.map(
        (signal, index) => (
          <div
            key={`${signal.label}-${index}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 10px",
              borderRadius: 10,
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {index + 1}. {signal.label}
            </div>

            <div className="muted" style={{ fontSize: 13 }}>
              {signal.percentChange !== undefined && (
                <>
                  {signal.percentChange > 0 ? "↑" : "↓"}
                  {Math.abs(signal.percentChange)}%
                  {" "}
                </>
              )}
              {signal.severity &&
  (signal.severity === "new"
    ? "New finding"
    : titleCase(signal.severity))}
            </div>
          </div>
        )
      )}
    </div>
  </div>
)}
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
    style={signalShiftPill(signal)}
    title={signal.interpretation}
  >
    {signal.label}
    {signal.percentChange !== undefined && (
      <>
        {" "}
        {signal.percentChange > 0 ? "↑" : "↓"}
        {Math.abs(signal.percentChange)}%
      </>
    )}
    {signal.severity && (
      <>
        {" "}· {titleCase(signal.severity)}
      </>
    )}
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

{/* ── Baseline status ───────────────────────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title-row">
  <div className="detail-section-title">
    Baseline Status
  </div>

  <button
    className="btn-secondary-small"
    onClick={() =>
      setShowBaselineStatus(!showBaselineStatus)
    }
    type="button"
  >
    {showBaselineStatus ? "Hide" : "Show"}
  </button>
</div>

  {showBaselineStatus && (
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
)}
</section>
     {/* ── What patient reported (filtered entities) ────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title-row">
    <div className="detail-section-title">What the Patient Reported</div>

    <button
      className="btn-secondary-small"
      onClick={() => setShowReportedDetails(!showReportedDetails)}
      type="button"
    >
      {showReportedDetails ? "Hide" : "Show"}
    </button>
  </div>

  {showReportedDetails &&
    (buckets.length === 0 ? (
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
    ))}
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
  : "Show"}
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
                    {m.role === "user" ? "Patient" : "MILO"}
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

function trajectoryBadge(summary) {
  const direction = summary?.trajectoryDirection || "stable";

  const styles = {
    stable: {
      background: "#F3F4F6",
      color: "#111827",
    },
    improving: {
      background: "#DBEAFE",
      color: "#1D4ED8",
    },
    worsening: {
      background: "#FED7AA",
      color: "#9A3412",
    },
    accelerating: {
      background: "#FEE2E2",
      color: "#991B1B",
    },
  };

  const style = styles[direction] || styles.stable;

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 11px",
    borderRadius: 999,
    background: style.background,
    color: style.color,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #E5E7EB",
  };
}

function agreementBadge(summary) {
  const agreement = summary?.agreementLevel || "low";

  const styles = {
    low: {
      background: "#F3F4F6",
      color: "#334155",
    },
    moderate: {
      background: "#EEF2FF",
      color: "#3730A3",
    },
    high: {
      background: "#DCFCE7",
      color: "#166534",
    },
  };

  const style = styles[agreement] || styles.low;

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 11px",
    borderRadius: 999,
    background: style.background,
    color: style.color,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #E5E7EB",
  };
}

function confidenceBadge(summary) {
  const confidence = summary?.confidenceLevel || "low";

  const styles = {
    low: {
      background: "#F3F4F6",
      color: "#334155",
    },
    moderate: {
      background: "#ECFDF5",
      color: "#166534",
    },
    high: {
      background: "#DCFCE7",
      color: "#166534",
    },
  };

  const style = styles[confidence] || styles.low;

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 11px",
    borderRadius: 999,
    background: style.background,
    color: style.color,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #E5E7EB",
  };
}

function velocityBadge(summary) {
  const velocity = summary?.velocityDirection || "stable";

  const directionStyles = {
    stable: {
      background: "#F3F4F6",
      color: "#334155",
    },
    increasing: {
      background: "#FCE7F3",
      color: "#9D174D",
    },
    decreasing: {
      background: "#DCFCE7",
      color: "#166534",
    },
    accelerating: {
      background: "#FEE2E2",
      color: "#991B1B",
    },
  };

  const style =
    directionStyles[velocity] ||
    directionStyles.stable;

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 11px",
    borderRadius: 999,
    background: style.background,
    color: style.color,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #E5E7EB",
  };
}

function signalShiftPill(signal) {
  const severity = signal?.severity || "stable";

  const severityStyles = {
    stable: { background: "#F3F4F6", color: "#111827" },
    mild: {
  background: "#FEF9C3",
  color: "#854D0E"
},
moderate: {
  background: "#FED7AA",
  color: "#9A3412"
},
    significant: { background: "#FEE2E2", color: "#991B1B" },
  };

  const fallbackByModality = {
    voice: { background: "#EEF2FF", color: "#111827" },
    vitals: { background: "#ECFDF5", color: "#111827" },
    patient_reported: { background: "#FEF3C7", color: "#111827" },
  };

  const style =
    signal?.severity
      ? severityStyles[severity] || severityStyles.stable
      : fallbackByModality[signal?.modality] || severityStyles.stable;

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: style.background,
    color: style.color,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid #E5E7EB",
  };
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
