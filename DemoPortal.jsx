export default function DemoPortal() {
  return (
    <main style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#102532" }}>
      <div style={{ height: 34, display: "grid", placeItems: "center", background: "#6f1d1b", color: "white", font: "800 12px/1 system-ui", letterSpacing: ".08em" }}>
        SYNTHETIC DEMO — NOT FOR CLINICAL USE — NO LIVE PATIENT DATA
      </div>
      <iframe
        title="OpenDx synthetic clinician demo"
        src="https://demo-dex-clinician.netlify.app/"
        referrerPolicy="no-referrer"
        style={{ width: "100%", height: "calc(100% - 34px)", border: 0, display: "block" }}
      />
    </main>
  );
}
