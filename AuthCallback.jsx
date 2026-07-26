import React, { useEffect, useState } from "react";
import { completeClinicianAuthentication } from "./clinicianCognito.js";

export default function AuthCallback({ onAuthenticated }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const callbackUrl = window.location.href;
    window.history.replaceState(null, "", window.location.pathname);
    completeClinicianAuthentication(callbackUrl)
      .then(onAuthenticated)
      .catch(() => setFailed(true));
  }, [onAuthenticated]);

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src="/predicate-logo-light.png" alt="Predicate" className="login-logo-image" />
        {failed ? (
          <p role="alert" className="login-error">
            Secure clinician sign-in could not be completed. Return to the dashboard and try again.
          </p>
        ) : (
          <p role="status">Verifying secure clinician sign-in…</p>
        )}
      </div>
    </div>
  );
}
