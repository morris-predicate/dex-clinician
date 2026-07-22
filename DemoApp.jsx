import React, { useMemo, useState } from "react";
import { DEMO_PATIENTS } from "./demoMode.js";

function Badge({ children }) { return <span className={`demo-status ${children.toLowerCase().replaceAll(" ", "-")}`}>{children}</span>; }

export default function DemoApp() {
  const [selectedId, setSelectedId] = useState(DEMO_PATIENTS[0].id);
  const selected = useMemo(() => DEMO_PATIENTS.find((patient) => patient.id === selectedId), [selectedId]);
  return (
    <div className="demo-dashboard">
      <div className="synthetic-demo-banner">SYNTHETIC DEMO — NOT FOR CLINICAL USE — NO LIVE PATIENT DATA</div>
      <aside className="demo-sidebar">
        <img src="/predicate-logo-light.png" alt="Predicate" className="demo-logo" />
        <div className="demo-product">OpenDx™ Signal Intelligence</div>
        <div className="demo-practice">Prerna Health · Demo</div>
        <nav>
          {DEMO_PATIENTS.map((patient) => (
            <button key={patient.id} className={patient.id === selectedId ? "active" : ""} onClick={() => setSelectedId(patient.id)}>
              <strong>{patient.name}</strong><small>{patient.status}</small>
            </button>
          ))}
        </nav>
      </aside>
      <main className="demo-main">
        <header className="demo-header">
          <div><span className="eyebrow">Synthetic patient overview</span><h1>{selected.name}</h1></div>
          <Badge>{selected.status}</Badge>
        </header>
        <section className="demo-summary-grid">
          <article><span>Age</span><strong>{selected.age}</strong></article>
          <article><span>Last MILO check-in</span><strong>{selected.lastCheckIn}</strong></article>
          <article><span>Current trend</span><strong>{selected.trend}</strong></article>
        </section>
        <section className="demo-panel"><h2>MILO summary</h2><p>{selected.summary}</p></section>
        <section className="demo-panel"><h2>Signal review</h2><div className="demo-signal-grid">
          {selected.signals.map(([label, value, context]) => <div className="demo-signal" key={label}><span>{label}</span><strong>{value}</strong><small>{context}</small></div>)}
        </div></section>
        <section className="demo-panel demo-note"><h2>Suggested clinician review</h2><p>{selected.careNote}</p></section>
        <footer>All names, measurements, summaries, and trends shown here are fabricated and stored only in this demo build.</footer>
      </main>
    </div>
  );
}
