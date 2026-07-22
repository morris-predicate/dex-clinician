import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installClinicianDemoMode } from "./demoMode.js";
import "./styles.css";

const demoMode = window.location.pathname === "/demo";
if (demoMode) installClinicianDemoMode();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App demoMode={demoMode} />
  </React.StrictMode>
);
