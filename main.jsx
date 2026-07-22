import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import DemoApp from "./DemoApp.jsx";
import { installDemoNetworkGuard, isIsolatedDemoRuntime } from "./demoMode.js";
import "./styles.css";

const DemoOrApp = isIsolatedDemoRuntime() ? DemoApp : App;
if (DemoOrApp === DemoApp) installDemoNetworkGuard();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DemoOrApp />
  </React.StrictMode>
);
