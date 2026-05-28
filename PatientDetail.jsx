import React, {
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useState,
} from "react";

import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import ForceGraph2D from "react-force-graph-2d";
import {
  fetchPatient,
  fetchTranscript,
  fetchPatientBaseline,
  fetchPatientVitals,
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

function normalizeVitalType(type) {
  if (!type) return "";

  const raw = String(type);
  const normalized = raw.toLowerCase();

  const aliases = {
    heart_rate: "heart_rate",
    "heart rate": "heart_rate",
    heartrate: "heart_rate",
    hr: "heart_rate",
    bpm: "heart_rate",
    HeartRate: "heart_rate",
    "Heart Rate": "heart_rate",

    hrv: "hrv_sdnn",
    hrv_sdnn: "hrv_sdnn",
    sdnn: "hrv_sdnn",
    heart_rate_variability: "hrv_sdnn",
    "heart rate variability": "hrv_sdnn",
    HeartRateVariabilitySDNN: "hrv_sdnn",
    "Heart Rate Variability": "hrv_sdnn",

    respiratory_rate: "respiratory_rate",
    "respiratory rate": "respiratory_rate",
    respiration_rate: "respiratory_rate",
    "respiration rate": "respiratory_rate",
    breathing_rate: "respiratory_rate",
    rr: "respiratory_rate",
    brpm: "respiratory_rate",
    RespirationRate: "respiratory_rate",
    "Respiratory Rate": "respiratory_rate",

    spo2: "spo2",
    sp_o2: "spo2",
    SpO2: "spo2",
    "SpO₂": "spo2",
    oxygen_saturation: "spo2",
    "oxygen saturation": "spo2",
    oxygen_saturation_percent: "spo2",
    oxygen_saturation_percentage: "spo2",
    peripheral_oxygen_saturation: "spo2",
    "Oxygen Saturation": "spo2",

    body_temperature: "body_temperature",
    "body temperature": "body_temperature",
    body_temp: "body_temperature",
    temperature: "body_temperature",
    temp: "body_temperature",
    "Temperature": "body_temperature",

    wrist_temperature: "wrist_temperature",
    "wrist temperature": "wrist_temperature",
    wrist_temp: "wrist_temperature",
    apple_sleeping_wrist_temperature: "wrist_temperature",
    sleeping_wrist_temperature: "wrist_temperature",
    "Apple Sleeping Wrist Temperature": "wrist_temperature",
  };

  return aliases[raw] || aliases[normalized] || normalized;
}

function getVitalDisplayUnit(vital) {
  const type = normalizeVitalType(
    vital?.type || vital?.metric || vital?.name || vital?.vitalType
  );

  const unitMap = {
    heart_rate: "bpm",
    hrv_sdnn: "ms",
    respiratory_rate: "br/min",
    spo2: "%",
    body_temperature: "°C",
    wrist_temperature: "°C Δ",
  };

  return unitMap[type] || "";
}

function getVitalDisplayLabel(vital) {
  const type = normalizeVitalType(
    vital?.type || vital?.metric || vital?.name || vital?.vitalType
  );

  const labelMap = {
    heart_rate: "Heart Rate",
    hrv_sdnn: "Heart Rate Variability",
    respiratory_rate: "Respiratory Rate",
    spo2: "Oxygen Saturation",
    body_temperature: "Temperature",
    wrist_temperature: "Wrist Temperature Δ",
  };

  return labelMap[type] || vital?.type || vital?.metric || "Vital";
}

function formatVitalDisplayValue(vital) {
  const type = normalizeVitalType(
    vital?.type || vital?.metric || vital?.name || vital?.vitalType
  );

  const n = Number(vital?.value);

  if (!Number.isFinite(n)) {
    return vital?.value ?? "—";
  }

  if (type === "spo2" && n > 0 && n <= 1) {
    return Math.round(n * 100);
  }

  if (type === "heart_rate" || type === "respiratory_rate") {
    return Math.round(n);
  }

  if (type === "hrv_sdnn") {
    return n.toFixed(1);
  }

  if (type === "body_temperature" || type === "wrist_temperature") {
    return n.toFixed(1);
  }

  return n;
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

function hasReportedFever(entities = []) {
  return entities.some((entity) => {
    const text = String(entity?.text || "").toLowerCase();
    const category = entity?.category;

    return (
      category === "MEDICAL_CONDITION" &&
      /\bfever\b|\bfebrile\b|\bchills\b/.test(text)
    );
  });
}

function getLatestVitalTimestamp(vitals = []) {
  const times = vitals
    .map((v) =>
      new Date(
        v.timestamp ||
          v.observedAt ||
          v.startDate ||
          v.endDate ||
          v.createdAt ||
          v.updatedAt
      ).getTime()
    )
    .filter((t) => Number.isFinite(t));

  if (!times.length) return null;

  return new Date(Math.max(...times));
}

function formatObservationTime(date) {
  if (!date) return "Not available";

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function clinicianizeText(value) {
  if (!value) return "";

  return String(value)
    .replaceAll("your usual baseline", "the patient’s usual baseline")
    .replaceAll("your baseline", "the patient’s baseline")
    .replaceAll("your usual breathing pattern", "the patient’s usual breathing pattern")
    .replaceAll("your usual readings", "the patient’s usual readings")
    .replaceAll("your usual patterns", "the patient’s usual patterns")
    .replaceAll("Your voice", "The patient’s voice")
    .replaceAll("your voice", "the patient’s voice")
    .replaceAll("you feel today", "the patient feels today")
    .replaceAll(
      "Worth checking in with how rested and how active you have been.",
      "Consider reviewing recent activity, sleep, hydration, medications, and symptom context."
    )
    .replaceAll(
      "This often shows up after extra stress, lighter sleep, or harder activity than usual.",
      "This may reflect physiologic stress, sleep disruption, recovery burden, recent activity, or other clinical context."
    )
    .replaceAll(
      "A small shift in the patient’s usual breathing pattern.",
      "Consider correlation with respiratory symptoms, anxiety, activity, fever, or other clinical context."
    )
    .replaceAll(
      "A small drift from the patient’s usual readings — worth a second look if it persists.",
      "Consider correlation with respiratory symptoms, device fit, activity, and persistence over time."
    )
    .replaceAll(
      "These wellness signals compare recent wearable and voice-pattern data with the patient’s usual baseline. They do not diagnose illness or replace medical advice.",
      "Recent wearable and voice-pattern data are compared with the patient’s usual baseline for signal context only."
    );
}

function KeyObservations({
  patient,
  vitals,
  entities,
  currentSignalInsight,
  fusionSummary,
  voiceDeviation,
}) {
  const signalEvidence =
    currentSignalInsight?.overallStatus?.signalEvidence || [];

  const hasChangedSignals = signalEvidence.length > 0;
  const latestVoiceAtForMap = patient?.latestSessionAt
    ? new Date(patient.latestSessionAt)
    : null;

  const patientReportedTextForMap =
    patient?.latestTranscriptSummary ||
    patient?.latestPatientStatement ||
    patient?.latestVoiceText ||
    patient?.latestSessionText ||
    null;

  const extractedSymptoms = (entities || [])
    .filter((entity) => entity.category === "MEDICAL_CONDITION")
    .map((entity) => entity.text)
    .filter(Boolean);

  const reviewWindowLabel =
    currentSignalInsight?.overallStatus?.temporalContext?.windowLabel ||
    currentSignalInsight?.overallStatus?.reviewWindow?.label ||
    "Current review window";

  const vitalSignals = signalEvidence.filter((signal) => {
    const id = String(signal.signal || signal.id || "").toLowerCase();
    const label = String(signal.label || "").toLowerCase();

    return (
      id.includes("heart") ||
      id.includes("hr") ||
      id.includes("resp") ||
      id.includes("rr") ||
      id.includes("spo2") ||
      id.includes("oxygen") ||
      id.includes("temp") ||
      id.includes("hrv") ||
      label.includes("heart") ||
      label.includes("resp") ||
      label.includes("oxygen") ||
      label.includes("spo") ||
      label.includes("temp") ||
      label.includes("hrv")
    );
  });

  const voiceSignalsForMap = signalEvidence.filter((signal) => {
    const id = String(signal.signal || signal.id || "").toLowerCase();
    const label = String(signal.label || "").toLowerCase();

    return (
      id.includes("voice") ||
      id.includes("speech") ||
      id.includes("pause") ||
      id.includes("tempo") ||
      id.includes("hesitation") ||
      label.includes("voice") ||
      label.includes("speech") ||
      label.includes("pause") ||
      label.includes("tempo") ||
      label.includes("hesitation")
    );
  });

  const otherSignals = signalEvidence.filter(
    (signal) =>
      !vitalSignals.includes(signal) &&
      !voiceSignalsForMap.includes(signal)
  );

  const hasVoiceContext =
    latestVoiceAtForMap ||
    patientReportedTextForMap ||
    extractedSymptoms.length > 0 ||
    voiceSignalsForMap.length > 0 ||
    voiceDeviation?.compared;

  if (!hasChangedSignals && !hasVoiceContext) {
    return (
      <div className="key-observations-card">
        <div className="key-observations-header">
          <div>
            <div className="key-observations-title">Key Observations</div>
            <div className="key-observations-subtitle">
              Descriptive observations appear when meaningful changes are detected across health signals.
            </div>
          </div>

          <div className="key-observations-badge stable">
            No noteworthy changes
          </div>
        </div>

        <div className="key-observations-empty">
          No noteworthy multi-signal changes were detected in the current review window.
        </div>
      </div>
    );
  }

  return (
    <div className="key-observations-card">
      <div className="key-observations-header">
        <div>
          <div className="key-observations-title">Key Observations</div>
          <div className="key-observations-subtitle">
  {reviewWindowLabel} · Signals reviewed together in the current clinical context
</div>
        </div>

        <div
          className={
            hasChangedSignals
              ? "key-observations-badge attention"
              : "key-observations-badge stable"
          }
        >
          {hasChangedSignals ? "Noteworthy signal changes" : "No changed signal evidence"}
        </div>
      </div>
           
      <div className="observation-two-column">
        <div className="observation-signal-panel">
          <div className="observation-panel-title">
            Vital Signal Trends
          </div>

          {vitalSignals.length > 0 ? (
            <ul className="observation-list">
              {vitalSignals.map((signal) => {
                const text = clinicianizeText(
                  signal.explanation ||
                    signal.interpretation ||
                    "Changed signal evidence detected."
                );

                const direction =
                  signal.direction === "decreased" || /lower|below|drift/i.test(text)
                    ? "↓"
                    : signal.direction === "increased" || /higher|above|elevated/i.test(text)
                    ? "↑"
                    : "•";

                const directionClass =
                  direction === "↑"
                    ? "signal-arrow-up"
                    : direction === "↓"
                    ? "signal-arrow-down"
                    : "signal-arrow-neutral";

                const conciseText = text
                  .replace(`${signal.label} is `, "")
                  .replace(`${signal.label} `, "")
                  .replace(
                    "noticeably higher than the patient’s usual baseline.",
                    "above patient baseline."
                  )
                  .replace(
                    "noticeably lower than the patient’s usual baseline.",
                    "below patient baseline."
                  )
                  .replace(
                    "noticeably higher than the patient’s baseline.",
                    "above patient baseline."
                  )
                  .replace(
                    "noticeably lower than the patient’s baseline.",
                    "below patient baseline."
                  );

                return (
                  <li
                    key={signal.signal || signal.id || signal.label}
                    className="observation-signal-item"
                  >
                    <span className={`signal-arrow ${directionClass}`}>
                      {direction}
                    </span>

                    <span>
                      <strong>{signal.label}:</strong>{" "}
                      {conciseText}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="observation-empty-line">
              No noteworthy vital-sign trend changes detected in this window.
            </div>
          )}
        </div>

        <div className="observation-voice-panel">
          <div className="observation-panel-title">
            Voice / Patient-Reported Context
          </div>

          {patientReportedTextForMap ? (
            <div className="voice-quote">
              “{patientReportedTextForMap}”
            </div>
          ) : extractedSymptoms.length > 0 ? (
            <div className="voice-quote">
              “{extractedSymptoms.join(", ")}”
            </div>
          ) : latestVoiceAtForMap ? (
            <div className="voice-quote muted-voice">
              Voice entry captured. No symptom quote available.
            </div>
          ) : (
            <div className="observation-empty-line">
              No voice entry is available in this review window.
            </div>
          )}

          {voiceSignalsForMap.length > 0 && (
            <ul className="observation-list voice-signal-list">
              {voiceSignalsForMap.map((signal) => (
                <li key={signal.signal || signal.id || signal.label}>
                  <strong>{signal.label}:</strong>{" "}
                  {clinicianizeText(
                    signal.explanation ||
                      signal.interpretation ||
                      "Voice signal change detected."
                  )}
                </li>
              ))}
            </ul>
          )}

          {!voiceSignalsForMap.length && voiceDeviation?.compared && (
            <div className="observation-empty-line">
              Voice compared with baseline: {titleCase(voiceDeviation.deviationLevel)}.
            </div>
          )}

          {!voiceDeviation?.compared && (
            <div className="observation-empty-line">
              Voice baseline comparison is not yet available.
            </div>
          )}
        </div>
      </div>

      {otherSignals.length > 0 && (
        <div className="observation-other-panel">
          <div className="observation-panel-title">
            Additional Signal Context
          </div>

          <ul className="observation-list">
            {otherSignals.map((signal) => (
              <li key={signal.signal || signal.id || signal.label}>
                <strong>{signal.label}:</strong>{" "}
                {clinicianizeText(
                  signal.explanation ||
                    signal.interpretation ||
                    "Additional signal context detected."
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {fusionSummary?.fusionSummary?.signalAlignment?.interpretation && (
        <div className="observation-alignment-note">
          <strong>Signal alignment:</strong>{" "}
          {clinicianizeText(
            fusionSummary.fusionSummary.signalAlignment.interpretation
          )}
        </div>
      )}
    </div>
  );
}
  
// ─── Time-Aligned Insights ──────────────────────────────────────────────────
function TimeAlignedInsights({ vitals, voiceDeviation, baseline, patient, }) {
  const [timeWindow, setTimeWindow] = useState("1h");
  const [activeParams, setActiveParams] = useState(["HR", "HRV", "RR", "SpO2", "Temp"]);
  const [draggingParam, setDraggingParam] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);

  const METRIC_ALIASES = useMemo(() => ({
    heart_rate: "heart_rate",
    "heart rate": "heart_rate",
    heartrate: "heart_rate",
    heart_rate_bpm: "heart_rate",
    hr: "heart_rate",
    bpm: "heart_rate",
    HeartRate: "heart_rate",
    "Heart Rate": "heart_rate",
    HKQuantityTypeIdentifierHeartRate: "heart_rate",
    hkquantitytypeidentifierheartrate: "heart_rate",

    hrv: "hrv_sdnn",
    hrv_sdnn: "hrv_sdnn",
    sdnn: "hrv_sdnn",
    heart_rate_variability: "hrv_sdnn",
    "heart rate variability": "hrv_sdnn",
    heart_rate_variability_sdnn: "hrv_sdnn",
    HeartRateVariabilitySDNN: "hrv_sdnn",
    "Heart Rate Variability": "hrv_sdnn",
    HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "hrv_sdnn",
    hkquantitytypeidentifierheartratevariabilitysdnn: "hrv_sdnn",

    respiratory_rate: "respiratory_rate",
    "respiratory rate": "respiratory_rate",
    respiration_rate: "respiratory_rate",
    "respiration rate": "respiratory_rate",
    breathing_rate: "respiratory_rate",
    rr: "respiratory_rate",
    brpm: "respiratory_rate",
    RespirationRate: "respiratory_rate",
    "Respiratory Rate": "respiratory_rate",
    HKQuantityTypeIdentifierRespiratoryRate: "respiratory_rate",
    hkquantitytypeidentifierrespiratoryrate: "respiratory_rate",

    spo2: "spo2",
    sp_o2: "spo2",
    SpO2: "spo2",
    "SpO2": "spo2",
    "SpO₂": "spo2",
    oxygen_saturation: "spo2",
    "oxygen saturation": "spo2",
    oxygen_saturation_percent: "spo2",
    oxygen_saturation_percentage: "spo2",
    peripheral_oxygen_saturation: "spo2",
    "Oxygen Saturation": "spo2",
    HKQuantityTypeIdentifierOxygenSaturation: "spo2",
    hkquantitytypeidentifieroxygensaturation: "spo2",

    body_temperature: "body_temperature",
    "body temperature": "body_temperature",
    body_temp: "body_temperature",
    temperature: "body_temperature",
    temp: "body_temperature",
    "Temperature": "body_temperature",
    HKQuantityTypeIdentifierBodyTemperature: "body_temperature",
    hkquantitytypeidentifierbodytemperature: "body_temperature",

    wrist_temperature: "wrist_temperature",
    "wrist temperature": "wrist_temperature",
    wrist_temp: "wrist_temperature",
    apple_sleeping_wrist_temperature: "wrist_temperature",
    sleeping_wrist_temperature: "wrist_temperature",
    "Apple Sleeping Wrist Temperature": "wrist_temperature",
    HKQuantityTypeIdentifierAppleSleepingWristTemperature: "wrist_temperature",
    hkquantitytypeidentifierapplesleepingwristtemperature: "wrist_temperature",
  }), []);

  const ALL_PARAMS = useMemo(() => [
    {
      id: "HR",
      label: "Heart Rate",
      unit: "bpm",
      color: "#EF4444",
      vitalTypes: ["heart_rate", "hr", "HeartRate"],
      yAxis: 0,
      shortLabel: "HR",
    },
    {
      id: "HRV",
      label: "Heart Rate Variability",
      unit: "ms",
      color: "#14B8A6",
      vitalTypes: ["hrv_sdnn", "hrv", "heart_rate_variability", "HeartRateVariabilitySDNN"],
      yAxis: 0,
      shortLabel: "HRV",
    },
    {
      id: "RR",
      label: "Resp. Rate",
      unit: "br/min",
      color: "#06B6D4",
      vitalTypes: ["respiratory_rate", "rr", "RespirationRate"],
      yAxis: 0,
      shortLabel: "RR",
    },
    {
      id: "SpO2",
      label: "SpO₂",
      unit: "%",
      color: "#8B5CF6",
      vitalTypes: ["spo2", "SpO2", "oxygen_saturation", "oxygen_saturation_percent"],
      yAxis: 1,
      shortLabel: "SpO₂",
    },
    {
      id: "Temp",
      label: "Temperature",
      unit: "°C",
      color: "#F59E0B",
      vitalTypes: ["wrist_temperature", "body_temperature", "temperature", "temp", "apple_sleeping_wrist_temperature"],
      yAxis: 1,
      shortLabel: "Temp",
    },
  ], []);
    const windowMs = useMemo(
    () => ({ "1h": 1, "6h": 6, "12h": 12, "24h": 24, "7d": 168 }[timeWindow] * 3600 * 1000),
    [timeWindow]
  );

  function getVitalTimestamp(v) {
    return (
      v?.timestamp ||
      v?.observedAt ||
      v?.observed_at ||
      v?.startDate ||
      v?.start_date ||
      v?.endDate ||
      v?.end_date ||
      v?.createdAt ||
      v?.created_at ||
      v?.updatedAt ||
      v?.updated_at ||
      v?.date
    );
  }

  function getVitalType(v) {
    return (
      v?.type ||
      v?.metric ||
      v?.metricType ||
      v?.metric_type ||
      v?.name ||
      v?.vitalType ||
      v?.vital_type ||
      v?.code ||
      v?.identifier ||
      v?.quantityType ||
      v?.quantity_type
    );
  }

  function getVitalValue(v) {
    return (
      v?.value ??
      v?.numericValue ??
      v?.numeric_value ??
      v?.quantity ??
      v?.amount ??
      v?.measurement ??
      v?.data?.value ??
      v?.sample?.value
    );
  }

  function normalizeType(type) {
    if (!type) return null;

    const raw = String(type);
    const lower = raw.toLowerCase();

    return (
      METRIC_ALIASES[raw] ||
      METRIC_ALIASES[lower] ||
      lower
    );
  }

  function normalizeValue(paramId, value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;

    // Some pipelines store SpO₂ as 0.97 instead of 97.
    if (paramId === "SpO2" && n > 0 && n <= 1) {
      return n * 100;
    }

    return n;
  }

  const now = useMemo(() => {
    const latestVitalTime = Math.max(
      ...((vitals || [])
        .map((v) => new Date(getVitalTimestamp(v)).getTime())
        .filter((t) => Number.isFinite(t)))
    );

    return Number.isFinite(latestVitalTime)
      ? latestVitalTime
      : Date.now();
  }, [vitals]);

      const mainSeries = useMemo(() => {
    return ALL_PARAMS
      .filter((p) => activeParams.includes(p.id))
      .map((param) => {
        const acceptedTypes = new Set(
          param.vitalTypes
            .map((type) => normalizeType(type))
            .filter(Boolean)
        );

        const data = (vitals || [])
          .map((v) => {
            const rawType = getVitalType(v);
            const normalizedType = normalizeType(rawType);

            const timestamp = getVitalTimestamp(v);
            const t = new Date(timestamp).getTime();

            const rawValue = getVitalValue(v);
            const y = normalizeValue(param.id, rawValue);

            if (
              !acceptedTypes.has(normalizedType) ||
              !Number.isFinite(t) ||
              y === null ||
              t < now - windowMs ||
              t > now
            ) {
              return null;
            }

            return {
              x: t,
              y,
              metricId: param.id,
              unit: param.unit,
              rawType,
              normalizedType,
              rawValue,
              raw: v,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.x - b.x);

        return {
  name: `${param.shortLabel} (${param.unit})`,
  metricId: param.id,
  unit: param.unit,
  data,
  color: param.color,
  yAxis: param.yAxis,
  type: data.length < 2 ? "scatter" : "spline",
  lineWidth: data.length < 2 ? 0 : 2,
  dashStyle: "Solid",
  marker: { enabled: true, radius: 4, symbol: "circle" },
};
      });
  }, [ALL_PARAMS, activeParams, vitals, windowMs, now]);

    const baselinePlotLines = useMemo(() => {
    const possibleBaselines =
      baseline?.vitalsBaseline ||
      baseline?.vitals ||
      baseline?.baselineVitals ||
      baseline?.physiology ||
      {};

    function getBaselineForParam(param) {
      const candidates = [
        param.id,
        param.shortLabel,
        ...(param.vitalTypes || []),
      ];

      for (const key of candidates) {
        const direct = possibleBaselines?.[key];
        const nested =
          possibleBaselines?.[key]?.value ??
          possibleBaselines?.[key]?.mean ??
          possibleBaselines?.[key]?.baseline;

        const value = nested ?? direct;

        if (Number.isFinite(Number(value))) {
          return Number(value);
        }
      }

      return null;
    }

    return ALL_PARAMS
      .filter((param) => activeParams.includes(param.id))
      .map((param) => {
        const value = getBaselineForParam(param);
        if (!Number.isFinite(value)) return null;

        return {
          yAxis: param.yAxis,
          plotLine: {
            value,
            color: `${param.color}99`,
            dashStyle: "Dash",
            width: 1,
            zIndex: 3,
            label: {
              text: `${param.shortLabel} baseline`,
              style: {
                color: "#94A3B8",
                fontSize: "10px",
              },
            },
          },
        };
      })
      .filter(Boolean);
  }, [ALL_PARAMS, activeParams, baseline]);

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
      patient?.latestSessionAt &&
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

        voiceSignalsForMap:
          voiceDeviation?.features
            ?.filter(
              (f) => f.severity !== "stable"
            )
            ?.map((f) => f.label) || [],
      },
    ];
  }, [patient, voiceDeviation, now, windowMs]);

  const selectedSnapshot = useMemo(() => {
    if (!selectedTime) return null;

    const toleranceMs =
      timeWindow === "1h"
        ? 8 * 60 * 1000
        : timeWindow === "6h"
        ? 20 * 60 * 1000
        : timeWindow === "12h"
        ? 40 * 60 * 1000
        : timeWindow === "24h"
        ? 90 * 60 * 1000
        : 12 * 60 * 60 * 1000;

    const values = mainSeries
      .filter((series) => series.metricId)
      .map((series) => {
        const closest = (series.data || []).reduce((best, point) => {
          const delta = Math.abs(point.x - selectedTime);

          if (!best || delta < best.delta) {
            return { point, delta };
          }

          return best;
        }, null);

        if (!closest || closest.delta > toleranceMs) {
          return {
            label: series.name,
            value: "—",
            unit: series.unit || "",
            color: series.color,
          };
        }

        return {
          label: series.name,
          value:
            typeof closest.point.y === "number"
              ? closest.point.y.toFixed(series.metricId === "SpO2" ? 0 : 1)
              : closest.point.y,
          unit: series.unit || "",
          color: series.color,
        };
      });

    const nearbyVoiceEvent = voiceCaptureEvents.find(
      (event) => Math.abs(event.time - selectedTime) <= toleranceMs
    );

    return {
      time: selectedTime,
      values,
      voiceEvent: nearbyVoiceEvent || null,
      voiceDeviation,
    };
  }, [
    selectedTime,
    mainSeries,
    voiceCaptureEvents,
    voiceDeviation,
    timeWindow,
  ]);
  const mainChartOptions = useMemo(() => ({
            chart: {
      type: "spline",
      backgroundColor: "#0F172A",
      plotBackgroundColor: "#0F172A",
      style: { fontFamily: "inherit" },
      height: 280,
      marginRight: 80,
      animation: false,
      events: {
        click: function (event) {
          const clickedTime = event?.xAxis?.[0]?.value;

          if (!Number.isFinite(clickedTime)) return;

          const allPoints = mainSeries
            .flatMap((series) => series.data || [])
            .filter((point) => Number.isFinite(point?.x));

          if (!allPoints.length) {
            setSelectedTime(clickedTime);
            return;
          }

          const nearest = allPoints.reduce((best, point) => {
            const delta = Math.abs(point.x - clickedTime);

            if (!best || delta < best.delta) {
              return { point, delta };
            }

            return best;
          }, null);

          setSelectedTime(nearest?.point?.x || clickedTime);
        },
      },
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
  min: now - windowMs,
  max: now,
  gridLineColor: "#1E293B",
  lineColor: "#334155",
  tickColor: "#334155",
  crosshair: {
    width: 1,
    color: "#94A3B8",
    dashStyle: "ShortDash",
  },
  labels: {
    style: { color: "#64748B", fontSize: "11px" },
    formatter: function () {
      if (timeWindow === "7d") {
        return Highcharts.dateFormat("%b %e", this.value);
      }

      return Highcharts.dateFormat("%H:%M", this.value);
    },
  },
  plotLines: [
    ...voiceCaptureEvents.map((event) => ({
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

    ...(selectedTime
      ? [
          {
            value: selectedTime,
            color: "#F8FAFC",
            width: 1,
            dashStyle: "Solid",
            zIndex: 12,
            label: {
              text: "Selected time",
              rotation: 0,
              y: 14,
              style: {
                color: "#F8FAFC",
                fontSize: "10px",
                fontWeight: "700",
              },
            },
          },
        ]
      : []),
  ],
},
        yAxis: [
      {
        title: { text: "HR / HRV / RR", style: { color: "#64748B", fontSize: "11px" } },
        gridLineColor: "#1E293B",
        labels: { style: { color: "#64748B", fontSize: "11px" } },
        min: 0,
        plotLines: baselinePlotLines
          .filter((item) => item.yAxis === 0)
          .map((item) => item.plotLine),
      },
      {
        title: { text: "SpO₂ / Temp", style: { color: "#64748B", fontSize: "11px" } },
        gridLineColor: "#1E293B",
        labels: { style: { color: "#64748B", fontSize: "11px" } },
        opposite: true,
        min: 0,
        plotLines: baselinePlotLines
          .filter((item) => item.yAxis === 1)
          .map((item) => item.plotLine),
      },
    ],

          tooltip: {
      backgroundColor: "#1E293B",
      borderColor: "#334155",
      style: { color: "#F8FAFC" },
      shared: false,
      useHTML: true,
      snap: 18,
      followPointer: false,
      xDateFormat: timeWindow === "7d" ? "%b %e, %H:%M" : "%H:%M",

      formatter: function () {
        const metricId =
          this.point?.metricId ||
          this.series?.userOptions?.metricId;

        const param = ALL_PARAMS.find((p) => p.id === metricId);
        const label = param?.label || this.series.name;
        const unit =
          this.point?.unit ||
          this.series?.userOptions?.unit ||
          param?.unit ||
          "";

        const value =
          typeof this.y === "number"
            ? this.y.toFixed(metricId === "SpO2" ? 0 : 1)
            : this.y;

        return `
          <div style="font-size:12px;min-width:160px;">
            <strong>${label}</strong><br/>
            <span style="color:#94A3B8;">
              ${Highcharts.dateFormat("%b %e, %I:%M %p", this.x)}
            </span><br/>
            <span style="font-size:13px;font-weight:800;">
              ${value} ${unit}
            </span>
          </div>
        `;
      },

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
  series: {
    stickyTracking: true,
    findNearestPointBy: "xy",
    cursor: "crosshair",
    point: {
      events: {
        click: function () {
          if (Number.isFinite(this.x)) {
            setSelectedTime(this.x);
          }
        },
      },
    },
    states: {
      hover: {
        enabled: true,
        lineWidthPlus: 1,
      },
    },
  },
  spline: {
    marker: { enabled: true, radius: 4 },
  },
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
            ]?.y ?? 0
          : 0,
      label: event.label,
      symptoms: event.symptoms,
      voiceSignalsForMap: event.voiceSignalsForMap,
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

    const voiceSignalsForMap = this.voiceSignalsForMap?.length
      ? this.voiceSignalsForMap
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
  ${voiceSignalsForMap.map((s) => `• ${s}`).join("<br/>")}
`;
  },
},
}, // closes scatter series
], // closes series array
}), [
  ALL_PARAMS,
  mainSeries,
  voiceCaptureEvents,
  baselinePlotLines,
  selectedTime,
  timeWindow,
  windowMs,
  now,
]);

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
            <HighchartsReact
  key={`main-${timeWindow}-${now}`}
  highcharts={Highcharts}
  options={mainChartOptions}
/>
          )}
        </div>
      </div>

            {selectedSnapshot ? (
  <div className="selected-time-snapshot">
    <div className="selected-time-header">
      <div>
        <strong>Selected Time Snapshot</strong>
        <div className="selected-time-subtitle">
          {Highcharts.dateFormat("%b %e, %I:%M %p", selectedSnapshot.time)}
        </div>
      </div>

      <button
        type="button"
        className="selected-time-clear"
        onClick={() => setSelectedTime(null)}
      >
        Clear
      </button>
    </div>

    <div className="selected-time-values">
      {selectedSnapshot.values.map((item) => (
        <div key={item.label} className="selected-time-value">
          <span
            className="selected-time-dot"
            style={{ background: item.color }}
          />
          <span className="selected-time-label">{item.label}</span>
          <strong>
            {item.value} {item.unit}
          </strong>
        </div>
      ))}
    </div>

    <div className="selected-time-voice">
      <strong>Voice context:</strong>{" "}
      {selectedSnapshot.voiceEvent ? (
        <>
          Voice capture near this time
          {selectedSnapshot.voiceEvent.symptoms?.length
            ? ` · Reported: ${selectedSnapshot.voiceEvent.symptoms.join(", ")}`
            : ""}
          {selectedSnapshot.voiceEvent.voiceSignalsForMap?.length
            ? ` · Voice signals: ${selectedSnapshot.voiceEvent.voiceSignalsForMap.join(", ")}`
            : ""}
        </>
      ) : selectedSnapshot.voiceDeviation?.compared ? (
        <>
          VDI available for latest voice capture:{" "}
          {titleCase(selectedSnapshot.voiceDeviation.deviationLevel)}
        </>
      ) : (
        <>No time-aligned voice data available at this selected time.</>
      )}
    </div>
  </div>
) : (
  <div className="selected-time-snapshot selected-time-snapshot-empty">
    <strong>Selected Time Snapshot</strong>
    <span>
      Click any point or time on the trend chart to pin a vertical review line and compare displayed parameters.
    </span>
  </div>
)}

      {/* ── VDI sub-chart ── */}
      <div style={{ borderTop: "1px solid #1E293B" }}>
        {hasVdiData && vdiBarData ? (
          <div style={{ paddingLeft: 136 }}>
            <HighchartsReact
              key={`vdi-${timeWindow}-${now}`}
              highcharts={Highcharts}
              options={vdiChartOptions}
            />
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
  const [patientVitals, setPatientVitals] = useState([]);
  const [showBaselineDetails, setShowBaselineDetails] = useState(false);
  const [showBaselineStatus, setShowBaselineStatus] = useState(false);

  const [showTemporalTrajectory, setShowTemporalTrajectory] = useState(false);
  const [showReportedDetails, setShowReportedDetails] = useState(false);
  const [showVitals, setShowVitals] = useState(false);
  const [vitalsParameterFilter, setVitalsParameterFilter] = useState("all");

  const [fusionSummary, setFusionSummary] = useState(null);
  const [fusionLoading, setFusionLoading] = useState(false);

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
  .then(async ([patientData, baselineData]) => {
  setData(patientData);
  setBaseline(baselineData);

  const resolvedPatient =
    patientData?.patient || patientData || {};

  const resolvedPatientId =
    resolvedPatient?.patientId ||
    resolvedPatient?.id ||
    patientId;

  const resolvedSubjectUid =
    resolvedPatient?.subjectUid ||
    patientData?.subjectUid ||
    patientData?.patient?.subjectUid;

  const vitalsData = await fetchPatientVitals({
    patientId: resolvedPatientId,
    subjectUid: resolvedSubjectUid,
    clinicianKey,
    clinicId,
  });

  setPatientVitals(vitalsData);

  loadFusionSummary();
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
  if (
    !graphRef.current ||
    !currentSignalInsight?.overallStatus?.signalEvidence?.length
  ) {
    return;
  }

  const fg = graphRef.current;

  requestAnimationFrame(() => {
    fg.centerAt(0, 30, 0);
    fg.zoom(0.92, 0);
  });
}, [currentSignalInsight]);

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

  const { patient } = data;

  const vitals =
  patientVitals.length > 0
    ? patientVitals
    : Array.isArray(data?.vitals)
    ? data.vitals
    : Array.isArray(data?.patient?.vitals)
    ? data.patient.vitals
    : [];

const vitalParameterOptions = Array.from(
  new Set(vitals.map((v) => getVitalDisplayLabel(v)).filter(Boolean))
).sort();

const filteredVitals =
  vitalsParameterFilter === "all"
    ? vitals
    : vitals.filter(
        (v) => getVitalDisplayLabel(v) === vitalsParameterFilter
      );
  const entities = patient.latestEntities || [];
  const buckets = DISPLAY_CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    items: entities.filter((e) => e.category === key),
  })).filter((b) => b.items.length > 0);

const currentReviewWindow =
  currentSignalInsight?.overallStatus
    ?.signalEvidence?.length
    ? {
        clinicalContext:
          currentSignalInsight.overallStatus.clinician?.review
            ?.recommendedReview,
        signals:
          currentSignalInsight.overallStatus.signalEvidence.map(
            (signal) => ({
              id: signal.signal,
              label: signal.label,
              severity: signal.severity,
              interpretation: signal.explanation,
              percentChange: undefined,
            })
          ),
      }
    : null;

const hasCurrentSignalEvidence =
  currentSignalInsight?.overallStatus?.signalEvidence?.length > 0;

const hasVoiceBaseline =
  Boolean(baseline?.voiceBaseline?.exists);

const hasVoiceDeviationComparison =
  Boolean(voiceDeviation?.compared);

const hasTemporalWindows =
  Array.isArray(temporalTimeline?.windows) &&
  temporalTimeline.windows.length >= 2;

const hasValidTemporalSummary =
  Boolean(temporalTimeline?.temporalSummary);

const canShowTemporalTrajectory =
  hasVoiceBaseline &&
  hasVoiceDeviationComparison &&
  hasTemporalWindows &&
  hasValidTemporalSummary;

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
  {clinicianizeText(fusionSummary.fusionSummary.soWhat)
  .replace(
    "This does not diagnose a condition, but it may help prioritize timely clinician review.",
    ""
  )
  .trim()}
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

{/* ── Key Observations ─────────────────────────────────────────── */}
<section className="detail-section">
  <KeyObservations
    patient={patient}
    vitals={vitals}
    entities={entities}
    currentSignalInsight={currentSignalInsight}
    fusionSummary={fusionSummary}
    voiceDeviation={voiceDeviation}
  />
</section>

{/* ── What Changed Together ───────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title">
    What Changed Together?
  </div>

  <div className="muted" style={{ marginTop: -4, marginBottom: 10, fontSize: 12 }}>
    Concordance between patient-reported context, voice features, and physiologic signals.
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
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            background: "#111827",
            border: "1px solid #334155",
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

{hasCurrentSignalEvidence && (
<>
{/* ── Signal Intelligence Map ─────────────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title">
    Signal Intelligence Map
  </div>

  <div className="detail-card signal-map-card">
    {currentSignalInsightLoading ? (
      <div className="empty-state-small">
        Loading signal map…
      </div>
    ) : (() => {
      const signalEvidence =
  currentSignalInsight?.overallStatus?.signalEvidence || [];

const patientReportedTextForMap =
  patient?.latestTranscriptSummary ||
  patient?.latestPatientStatement ||
  patient?.latestVoiceText ||
  patient?.latestSessionText ||
  null;

const extractedSymptomsForMap = (entities || [])
  .filter((entity) => entity.category === "MEDICAL_CONDITION")
  .map((entity) => entity.text)
  .filter(Boolean);

const latestVoiceAtForMap = patient?.latestSessionAt
  ? new Date(patient.latestSessionAt)
  : null;

const voiceSignalsForMap = signalEvidence.filter((signal) => {
  const id = String(signal.signal || signal.id || "").toLowerCase();
  const label = String(signal.label || "").toLowerCase();

  return (
    id.includes("voice") ||
    id.includes("speech") ||
    id.includes("pause") ||
    id.includes("tempo") ||
    id.includes("hesitation") ||
    label.includes("voice") ||
    label.includes("speech") ||
    label.includes("pause") ||
    label.includes("tempo") ||
    label.includes("hesitation")
  );
});

const patientSymptoms = extractedSymptomsForMap
  .filter(Boolean)
  .slice(0, 6);

const hasPatientReportedContext =
  Boolean(patientReportedTextForMap) || patientSymptoms.length > 0;

const hasVoiceContext =
  Boolean(latestVoiceAtForMap) ||
  Boolean(voiceDeviation?.compared) ||
  voiceSignalsForMap.length > 0;

const hasPhysiologicContext = signalEvidence.length > 0;

      const hasFusionContext =
        Boolean(currentSignalInsight?.overallStatus?.fusionScore) ||
        Boolean(currentSignalInsight?.overallStatus?.clinician?.review) ||
        Boolean(currentSignalInsight?.overallStatus?.temporalContext);

      const hasSignalMapData =
        hasPatientReportedContext ||
        hasVoiceContext ||
        hasPhysiologicContext ||
        hasFusionContext;

      if (!hasSignalMapData) {
        return (
          <div className="empty-state-small">
            Signal intelligence unavailable
          </div>
        );
      }

      const nodes = [];
      const links = [];
      const added = new Set();

      const addNode = (node) => {
        if (!node?.id || added.has(node.id)) return;
        added.add(node.id);
        nodes.push(node);
      };

      const addLink = (source, target, label, group = "relationship") => {
        if (!source || !target) return;
        links.push({ source, target, label, group });
      };

      addNode({
        id: "clinical_context",
        label: "Current patient status",
        group: "fusion",
        detail:
          currentSignalInsight?.overallStatus?.clinician?.review
            ?.primaryFinding ||
          currentSignalInsight?.overallStatus?.summary ||
          "Available signals are shown as descriptive context only.",
        fx: 0,
        fy: 0,
      });

      if (hasPatientReportedContext) {
        addNode({
          id: "patient_reported_domain",
          label: "Patient-reported",
          group: "patient",
          detail:
            patientReportedTextForMap ||
            patientSymptoms.join(", ") ||
            "Patient-reported context available.",
          fx: -250,
          fy: -115,
        });

        addLink(
          "patient_reported_domain",
          "clinical_context",
          "reported context",
          "patient"
        );

        if (patientReportedTextForMap) {
          addNode({
            id: "reported_quote",
            label: "Reported statement",
            group: "patient_detail",
            detail: patientReportedTextForMap,
            fx: -390,
            fy: -175,
          });

          addLink(
            "reported_quote",
            "patient_reported_domain",
            "source",
            "patient"
          );
        }

        patientSymptoms.forEach((symptom, index) => {
          const id = `symptom_${index}`;
          addNode({
            id,
            label: symptom,
            group: "patient_detail",
            detail: `Extracted patient-reported context: ${symptom}`,
            fx: -405 + index * 30,
            fy: -40 + index * 22,
          });

          addLink(id, "patient_reported_domain", "reported", "patient");
        });
      }

      if (hasVoiceContext) {
        addNode({
          id: "voice_domain",
          label: "Voice signal",
          group: "voice",
          detail: voiceDeviation?.compared
            ? `Voice compared with baseline: ${titleCase(
                voiceDeviation.deviationLevel
              )}.`
            : latestVoiceAtForMap
              ? "Voice entry captured. Baseline comparison may be limited."
              : "Voice context available.",
          fx: 0,
          fy: -185,
        });

        addLink(
          "voice_domain",
          "clinical_context",
          "voice context",
          "voice"
        );

        (voiceSignalsForMap || []).slice(0, 5).forEach((signal, index) => {
          const id = `voice_signal_${signal.signal || signal.id || index}`;

          addNode({
            id,
            label: signal.label || signal.signal || "Voice feature",
            group: "voice_detail",
            detail: clinicianizeText(
              signal.explanation ||
                signal.interpretation ||
                "Voice signal context detected."
            ),
            fx: -80 + index * 42,
            fy: -300,
          });

          addLink(id, "voice_domain", "feature", "voice");
        });

        if (!voiceSignalsForMap?.length && voiceDeviation?.compared) {
          addNode({
            id: "voice_baseline_comparison",
            label: "Voice baseline comparison",
            group: "voice_detail",
            detail: `Voice comparison level: ${titleCase(
              voiceDeviation.deviationLevel
            )}.`,
            fx: 105,
            fy: -280,
          });

          addLink(
            "voice_baseline_comparison",
            "voice_domain",
            "baseline comparison",
            "voice"
          );
        }
      }

      if (hasPhysiologicContext) {
        addNode({
          id: "physiology_domain",
          label: "Physiologic signal",
          group: "physiology",
          detail: `${signalEvidence.length} physiologic signal${
            signalEvidence.length === 1 ? "" : "s"
          } contributed to the current review window.`,
          fx: 250,
          fy: -95,
        });

        addLink(
          "physiology_domain",
          "clinical_context",
          "physiologic context",
          "physiology"
        );

        signalEvidence.forEach((signal, index) => {
          const id = `phys_${signal.signal || signal.id || index}`;

          addNode({
            id,
            label: signal.label || signal.signal || "Physiologic signal",
            group: "physiology_detail",
            detail: clinicianizeText(
              signal.explanation ||
                signal.interpretation ||
                `${signal.label || "Signal"} changed compared with baseline.`
            ),
            direction: signal.direction,
            magnitude: signal.magnitude,
            severity: signal.severity,
            fx:
              360 +
              Math.cos((index / Math.max(signalEvidence.length, 1)) * Math.PI * 2) *
                95,
            fy:
              -35 +
              Math.sin((index / Math.max(signalEvidence.length, 1)) * Math.PI * 2) *
                85,
          });

          addLink(
            id,
            "physiology_domain",
            signal.direction || "changed",
            "physiology"
          );
        });
      }

      if (hasFusionContext) {
        const fusionScore =
          currentSignalInsight?.overallStatus?.fusionScore || {};

        addNode({
          id: "fusion_summary",
          label: fusionScore.crossDomainConvergence
            ? "Convergent signals"
            : signalEvidence.length > 1
            ? "Convergent signals"
            : "Single-domain signal",
          group: "fusion_detail",
          detail:
            currentSignalInsight?.overallStatus?.clinician?.review
              ?.confidenceRationale ||
            currentSignalInsight?.overallStatus?.temporalContext?.summary
              ?.interpretation ||
            "Fusion context is based only on available current signal evidence.",
          fx: 0,
          fy: 165,
        });

        addLink(
          "fusion_summary",
          "clinical_context",
          "summary",
          "fusion"
        );
      }

      const unavailableDomains = [
        !hasPatientReportedContext ? "patient-reported context" : null,
        !hasVoiceContext ? "voice signal context" : null,
        !hasPhysiologicContext ? "physiologic signal context" : null,
      ].filter(Boolean);

      const graphWidth =
        typeof window !== "undefined"
          ? Math.max(Math.min(window.innerWidth - 320, 1080), 760)
          : 900;

      return (
        <>
          <div className="muted signal-map-intro">
            This map shows available patient-reported, voice, physiologic, and
            fusion context from the current review window. Domains without real
            data are not inferred.
          </div>

          <div className="signal-map-legend">
            <span className="signal-map-pill signal-map-pill-patient">
              Patient-reported
            </span>
            <span className="signal-map-pill signal-map-pill-voice">
              Voice signal
            </span>
            <span className="signal-map-pill signal-map-pill-physiology">
              Physiologic signal
            </span>
            <span className="signal-map-pill signal-map-pill-fusion">
              Fusion context
            </span>
          </div>

          <div className="signal-map-shell">
            <ForceGraph2D
              ref={graphRef}
              graphData={{ nodes, links }}
              width={graphWidth}
              height={440}
              cooldownTicks={0}
              enableZoomInteraction={false}
              enablePanInteraction={false}
              enableNodeDrag={false}
              nodeRelSize={8}
              linkWidth={(link) =>
                link.group === "fusion" ? 1.8 : 1.2
              }
              linkColor={(link) => {
                if (link.group === "patient") return "rgba(251, 191, 36, 0.58)";
                if (link.group === "voice") return "rgba(129, 140, 248, 0.58)";
                if (link.group === "physiology") return "rgba(45, 212, 191, 0.58)";
                if (link.group === "fusion") return "rgba(248, 250, 252, 0.64)";
                return "rgba(148, 163, 184, 0.42)";
              }}
              linkDirectionalParticles={1}
              linkDirectionalParticleWidth={1.4}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              linkCurvature={0.08}
              nodeLabel={(node) =>
                `${node.label}\n\n${node.detail || "Available signal context."}`
              }
              nodeCanvasObject={(node, ctx, globalScale) => {
                const label = node.label || "";
                const fontSize = Math.max(10 / globalScale, 8);
                const radius =
                  node.group === "fusion"
                    ? 20 / globalScale
                    : node.group?.includes("detail")
                      ? 10 / globalScale
                      : 15 / globalScale;

                const colorMap = {
                  fusion: "#F8FAFC",
                  fusion_detail: "#CBD5E1",
                  patient: "#FBBF24",
                  patient_detail: "#FDE68A",
                  voice: "#818CF8",
                  voice_detail: "#C4B5FD",
                  physiology: "#2DD4BF",
                  physiology_detail: "#99F6E4",
                };

                const nodeColor = colorMap[node.group] || "#CBD5E1";
                const x = node.x || 0;
                const y = node.y || 0;

                ctx.save();

                ctx.shadowColor = nodeColor;
                ctx.shadowBlur = node.group === "fusion" ? 22 : 13;

                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2, false);
                ctx.fillStyle =
                  node.group === "fusion"
                    ? "rgba(15, 23, 42, 0.96)"
                    : "rgba(15, 23, 42, 0.82)";
                ctx.fill();

                ctx.lineWidth = node.group === "fusion" ? 2.2 / globalScale : 1.2 / globalScale;
                ctx.strokeStyle = nodeColor;
                ctx.stroke();

                ctx.shadowBlur = 0;
                ctx.font = `700 ${fontSize}px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = "#E5E7EB";

                const maxLabelWidth = 145 / globalScale;
                const words = label.split(" ");
                const lines = [];
                let line = "";

                words.forEach((word) => {
                  const test = line ? `${line} ${word}` : word;
                  if (ctx.measureText(test).width > maxLabelWidth && line) {
                    lines.push(line);
                    line = word;
                  } else {
                    line = test;
                  }
                });

                if (line) lines.push(line);

                lines.slice(0, 2).forEach((textLine, index) => {
                  ctx.fillText(
                    textLine,
                    x,
                    y + radius + 6 / globalScale + index * (fontSize + 2 / globalScale)
                  );
                });

                ctx.restore();
              }}
            />
          </div>

          {unavailableDomains.length > 0 && (
            <div className="signal-map-unavailable">
              Not shown because real data are not available in this review
              window: {unavailableDomains.join(", ")}.
            </div>
          )}

          <div className="signal-map-disclaimer">
            Descriptive signal context only. This map does not diagnose,
            predict, or recommend treatment.
          </div>
        </>
      );
    })()}
  </div>
</section>
</>
)}

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
    <div className="detail-card temporal-trajectory-card">
      {temporalLoading ? (
        <div className="empty-state-small">
          Loading temporal signal timeline…
        </div>
      ) : !canShowTemporalTrajectory ? (
        <div className="temporal-unavailable">
          <div className="temporal-unavailable-title">
            Temporal trajectory unavailable
          </div>

          <div className="temporal-unavailable-copy">
            This view requires a confirmed voice baseline, a current voice
            deviation comparison, and at least two review windows before a
            temporal trajectory can be shown.
          </div>

          <div className="temporal-requirements">
            <div className={hasVoiceBaseline ? "requirement-ok" : "requirement-missing"}>
              {hasVoiceBaseline ? "✓" : "•"} Voice baseline confirmed
            </div>

            <div className={hasVoiceDeviationComparison ? "requirement-ok" : "requirement-missing"}>
              {hasVoiceDeviationComparison ? "✓" : "•"} Voice deviation comparison available
            </div>

            <div className={hasTemporalWindows ? "requirement-ok" : "requirement-missing"}>
              {hasTemporalWindows ? "✓" : "•"} At least two temporal review windows available
            </div>

            <div className={hasValidTemporalSummary ? "requirement-ok" : "requirement-missing"}>
              {hasValidTemporalSummary ? "✓" : "•"} Temporal summary available
            </div>
          </div>

          <div className="clinical-safety-note">
            Temporal conclusions will remain hidden until the required data are present.
            No symptom, voice-baseline, or longitudinal trend should be inferred
            without source evidence.
          </div>
        </div>
      ) : (
        <>
          <div className="temporal-summary-panel">
            <div className="temporal-badge-row">
              <span style={trajectoryBadge(temporalTimeline.temporalSummary)}>
                {temporalTimeline.temporalSummary.trajectoryLabel ||
                  temporalTimeline.temporalSummary.label ||
                  "Trajectory available"}
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

            {temporalTimeline.temporalSummary.trajectoryContext && (
              <div className="muted" style={{ marginBottom: 8 }}>
                {temporalTimeline.temporalSummary.trajectoryContext}
              </div>
            )}

            {temporalTimeline.temporalSummary.velocityContext && (
              <div className="muted" style={{ marginBottom: 8 }}>
                {temporalTimeline.temporalSummary.velocityContext}
              </div>
            )}

            {temporalTimeline.temporalSummary.soWhat && (
              <div style={{ lineHeight: 1.5 }}>
                <strong>So what changed?</strong>{" "}
                {temporalTimeline.temporalSummary.soWhat}
              </div>
            )}

            {temporalTimeline.temporalSummary.confidenceLabel && (
              <div className="temporal-confidence-panel">
                <div style={{ marginBottom: 8 }}>
                  <span style={confidenceBadge(temporalTimeline.temporalSummary)}>
                    {temporalTimeline.temporalSummary.confidenceLabel}
                  </span>
                </div>

                {temporalTimeline.temporalSummary.confidenceContext && (
                  <div className="muted" style={{ marginBottom: 8 }}>
                    {temporalTimeline.temporalSummary.confidenceContext}
                  </div>
                )}

                <div style={{ display: "grid", gap: 6 }}>
                  {temporalTimeline.temporalSummary.confidenceDrivers
                    ?.filter((d) => d.type === "positive")
                    .map((driver) => (
                      <div
                        key={driver.label}
                        className="requirement-ok"
                        style={{ fontSize: 13 }}
                      >
                        ✓ {driver.label}
                      </div>
                    ))}

                  {temporalTimeline.temporalSummary.confidenceDrivers
                    ?.filter((d) => d.type === "limitation")
                    .map((driver) => (
                      <div
                        key={driver.label}
                        className="requirement-missing"
                        style={{ fontSize: 13 }}
                      >
                        ⚠ {driver.label}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {temporalTimeline.temporalSummary.topContributingSignals?.length > 0 && (
              <div className="temporal-contributing-panel">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  Top Contributing Signals
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {temporalTimeline.temporalSummary.topContributingSignals.map(
                    (signal, index) => (
                      <div
                        key={`${signal.label}-${index}`}
                        className="temporal-signal-row"
                      >
                        <div style={{ fontWeight: 600 }}>
                          {index + 1}. {signal.label}
                        </div>

                        <div className="muted" style={{ fontSize: 13 }}>
                          {signal.percentChange !== undefined && (
                            <>
                              {signal.percentChange > 0 ? "↑" : "↓"}
                              {Math.abs(signal.percentChange)}
                              %
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
                className="temporal-window-card"
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    gap: 12,
                  }}
                >
                  <strong>{window.label}</strong>

                  <span className="muted">
                    {formatDateTime(window.timestamp)}
                  </span>
                </div>

                {window.clinicalContext && (
                  <div className="muted" style={{ marginBottom: 10 }}>
                    {window.clinicalContext}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {window.signals?.map((signal) => (
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
                          {Math.abs(signal.percentChange)}
                          %
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
            {temporalTimeline.fdaSafeDisclaimer ||
              "Descriptive signal intelligence only. Not diagnostic."}
          </div>
        </>
      )}
    </div>
  )}
</section>

{/* ── Vitals ───────────────────────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title-row">
    <div className="detail-section-title">Vitals</div>

    <button
      className="btn-secondary-small"
      onClick={() => setShowVitals(!showVitals)}
      type="button"
    >
      {showVitals ? "Hide" : "Show"}
    </button>
  </div>

  {showVitals && (
    <div className="detail-card">
      <div className="vitals-filter-row">
        <label className="vitals-filter-label">
          Filter by parameter
        </label>

        <select
          className="vitals-filter-select"
          value={vitalsParameterFilter}
          onChange={(e) => setVitalsParameterFilter(e.target.value)}
        >
          <option value="all">All parameters</option>

          {vitalParameterOptions.map((parameter) => (
            <option key={parameter} value={parameter}>
              {parameter}
            </option>
          ))}
        </select>
      </div>
      {vitals && vitals.length > 0 ? (
        <VitalsTable vitals={filteredVitals} />
      ) : (
        <div className="empty-state-small">
          No wearable connected.
          <span className="muted-inline">
            {" "}Voice-only monitoring active
          </span>
        </div>
      )}
    </div>
  )}
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
          <th>Parameter</th>
          <th>Value</th>
          <th>When</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {vitals.slice(0, 20).map((v, i) => (
          <tr key={i}>
            <td>{getVitalDisplayLabel(v)}</td>
            <td>
              {formatVitalDisplayValue(v)} {getVitalDisplayUnit(v)}
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
    wrist_temperature: "Wrist temp",
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
