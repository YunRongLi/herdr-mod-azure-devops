import { exec } from "herdr";

/**
 * Cache entry for OAuth token.
 * @type {{ token: string, expiresAt: number } | null}
 */
let cachedToken = null;

// Azure DevOps well-known resource ID for OAuth tokens
const ADO_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";

/**
 * Clears the in-memory token cache.
 */
export function clearAuthCache() {
  cachedToken = null;
}

/**
 * Obtains an Azure DevOps OAuth Bearer token using host Azure CLI session.
 * Caches valid tokens until 60 seconds before expiration.
 *
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<string>} Bearer access token
 */
export async function getAccessToken(options = {}) {
  const now = Date.now();

  if (!options.forceRefresh && cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token;
  }

  let res;
  try {
    res = await exec("az", [
      "account",
      "get-access-token",
      "--resource",
      ADO_RESOURCE_ID,
      "-o",
      "json",
    ]);
  } catch (err) {
    throw new Error(
      `Azure CLI execution failed: ${err.message || String(err)}. Make sure 'azure-cli' is installed and in PATH.`
    );
  }

  if (res.code !== 0) {
    const stderr = (res.stderr || "").trim();
    if (stderr.includes("az login") || stderr.includes("No subscription")) {
      throw new Error("Azure CLI session expired or not logged in. Please run 'az login' in your terminal.");
    }
    throw new Error(stderr || "Failed to obtain Azure DevOps access token from Azure CLI.");
  }

  let data;
  try {
    data = JSON.parse(res.stdout);
  } catch {
    throw new Error("Invalid JSON response received from Azure CLI.");
  }

  const token = data.accessToken || data.token;
  if (!token) {
    throw new Error("Azure CLI response did not contain an access token.");
  }

  // Parse expiration: handles both ISO string (expiresOn) and epoch timestamp (expires_on)
  let expiresAt = now + 3600 * 1000; // default 1 hour fallback
  if (data.expiresOn) {
    const parsed = Date.parse(data.expiresOn);
    if (!Number.isNaN(parsed)) {
      expiresAt = parsed;
    }
  } else if (data.expires_on) {
    const epochSec = Number(data.expires_on);
    if (!Number.isNaN(epochSec)) {
      expiresAt = epochSec * 1000;
    }
  }

  cachedToken = { token, expiresAt };
  return token;
}
