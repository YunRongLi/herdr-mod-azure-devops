import { exec, window as getHerdrWindow } from "herdr";

// Allowed Azure DevOps domain patterns
const ALLOWED_ADO_HOST_SUFFIXES = [
  "dev.azure.com",
  ".visualstudio.com",
];

/**
 * Extracts organization name from URL.
 * Handles:
 * - https://dev.azure.com/{org}
 * - https://{org}.visualstudio.com
 * @param {string} url
 * @returns {string}
 */
export function extractOrgName(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname.endsWith(".visualstudio.com")) {
      return parsed.hostname.split(".")[0];
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[0] || "";
  } catch {
    const parts = url.trim().split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }
}

/**
 * Validates that a URL is a secure HTTPS URL and is a legitimate Azure DevOps host.
 * Protects against Bearer token exfiltration to untrusted servers (SSRF/Credential Leakage).
 *
 * @param {string} rawUrl
 * @param {boolean} [allowEnterprise=true] Allow on-premises HTTPS Azure DevOps Server
 * @returns {URL}
 */
export function assertSafeAdoUrl(rawUrl, allowEnterprise = true) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("URL must be a non-empty string.");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`Invalid URL format: '${rawUrl}'`);
  }

  // Enforce HTTPS without exception
  if (parsed.protocol !== "https:") {
    throw new Error(`Insecure protocol '${parsed.protocol}'. Azure DevOps connections must use HTTPS.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check known public ADO cloud hostnames
  const isPublicAdo =
    hostname === "dev.azure.com" ||
    hostname.endsWith(".visualstudio.com");

  if (isPublicAdo) {
    return parsed;
  }

  // Reject localhost, private/loopback IP addresses to prevent SSRF
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("169.254.") || // Cloud metadata
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    (hostname.startsWith("172.") && isPrivate172(hostname))
  ) {
    throw new Error(`Connection to private or loopback host '${hostname}' is rejected for security.`);
  }

  if (!allowEnterprise) {
    throw new Error(`Host '${hostname}' is not a recognized Azure DevOps domain.`);
  }

  return parsed;
}

/**
 * Helper to check 172.16.0.0/12 private range.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivate172(ip) {
  const parts = ip.split(".");
  if (parts.length < 2) return false;
  const second = Number(parts[1]);
  return second >= 16 && second <= 31;
}

/**
 * Checks if a string is a safe HTTP/HTTPS URL for external browser navigation.
 * @param {string} urlString
 * @returns {boolean}
 */
export function isSafeBrowserUrl(urlString) {
  if (!urlString || typeof urlString !== "string") return false;
  try {
    const u = new URL(urlString.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Safely opens a URL in the user's default browser across Linux, Windows, and macOS.
 * Validates protocol before execution to prevent command or URI handler injection.
 *
 * @param {string} urlString
 * @returns {Promise<void>}
 */
export async function openExternalUrl(urlString) {
  if (!isSafeBrowserUrl(urlString)) {
    throw new Error(`Blocked opening unsafe URL: '${urlString}'`);
  }

  const cleanUrl = urlString.trim();
  const w = getHerdrWindow?.() || {};
  const platform = w.platform || (navigator?.userAgent?.includes("Win") ? "windows" : "linux");

  try {
    if (platform === "windows") {
      await exec("cmd", ["/c", "start", "", cleanUrl]);
    } else if (platform === "macos") {
      await exec("open", [cleanUrl]);
    } else {
      await exec("xdg-open", [cleanUrl]);
    }
  } catch {
    // Non-fatal if browser launcher fails
  }
}

/**
 * Sanitizes untrusted text by removing dangerous control characters, ANSI escape sequences,
 * and null bytes before passing to UI or terminal agents.
 *
 * @param {string} text
 * @returns {string}
 */
export function sanitizeText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\0/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Validates that an agent runner name is a safe binary identifier (e.g. 'claude', 'cursor-agent').
 * Prevents path traversal and parameter injection.
 *
 * @param {string} agentName
 * @returns {boolean}
 */
export function isValidAgentName(agentName) {
  if (!agentName || typeof agentName !== "string") return false;
  return /^[a-zA-Z0-9_\-\.]+$/.test(agentName.trim());
}
