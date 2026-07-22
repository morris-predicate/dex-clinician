import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import DemoPortal from "./DemoPortal.jsx";
import "./styles.css";

const RootApplication = window.location.pathname === "/demo" ? DemoPortal : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApplication />
  </React.StrictMode>
);
