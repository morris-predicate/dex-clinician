export const AUTH_MODES = Object.freeze({
  CONTROLLED_BETA_ACCESS_KEY: "controlled-beta-access-key",
  GOVERNED_COGNITO: "governed-cognito",
});

export const AUTH_MODE_STORAGE_KEY = "dex.clinician.auth-mode";

export function isGovernedCognitoMode(mode) {
  return mode === AUTH_MODES.GOVERNED_COGNITO;
}
