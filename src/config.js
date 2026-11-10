import { shared, setShared } from "herdr";
import { assertSafeAdoUrl, isValidAgentName, sanitizeText } from "./utils.js";

const CONFIG_KEY = "azure-devops.config";

/**
 * @typedef {Object} AdoConfig
 * @property {string} organization Organization URL (e.g., https://dev.azure.com/myorg)
 * @property {string} project Project name
 * @property {string} agent Default agent executable name (default: "claude")
 */

/**
 * Normalizes and validates an organization URL.
 * Enforces HTTPS and removes trailing slashes.
 *
 * @param {string} url
 * @returns {string}
 */
export function cleanOrgUrl(url) {
  if (!url) return "";
  let cleaned = url.trim();
  while (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  // Enforce https protocol
  if (cleaned.startsWith("http://")) {
    cleaned = "https://" + cleaned.slice(7);
  } else if (!cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned;
  }
  return cleaned;
}

/**
 * Extracts organization name from URL.
 * Handles:
 * - https://dev.azure.com/{org}
 * - https://{org}.visualstudio.com
 * @param {string} url
 * @returns {string}
 */
export function extractOrgName(url) {
  const cleaned = cleanOrgUrl(url);
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.endsWith(".visualstudio.com")) {
      return parsed.hostname.split(".")[0];
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[0] || "";
  } catch {
    const parts = cleaned.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }
}

/**
 * Validates project name to prevent path traversal or special characters.
 * @param {string} project
 * @returns {boolean}
 */
export function isValidProjectName(project) {
  if (!project || typeof project !== "string") return false;
  const trimmed = project.trim();
  // Azure DevOps projects allow alphanumeric, spaces, underscores, hyphens, and periods (1-64 chars)
  return /^[a-zA-Z0-9_\-\. ]{1,64}$/.test(trimmed) && !trimmed.includes("..");
}

/**
 * Retrieves the current configuration from Herdr shared state.
 * @returns {AdoConfig}
 */
export function loadConfig() {
  const stored = shared(CONFIG_KEY);
  if (stored && typeof stored === "object") {
    const rawOrg = typeof stored.organization === "string" ? stored.organization : "";
    const rawProject = typeof stored.project === "string" ? stored.project : "";
    const rawAgent = typeof stored.agent === "string" ? stored.agent : "claude";

    return {
      organization: cleanOrgUrl(rawOrg),
      project: sanitizeText(rawProject).trim(),
      agent: isValidAgentName(rawAgent) ? rawAgent.trim() : "claude",
    };
  }
  return {
    organization: "",
    project: "",
    agent: "claude",
  };
}

/**
 * Persists the configuration into Herdr shared state with validation.
 * @param {Partial<AdoConfig>} updates
 * @returns {AdoConfig}
 */
export function saveConfig(updates) {
  const current = loadConfig();

  let nextOrg = current.organization;
  if (updates.organization !== undefined) {
    const cleaned = cleanOrgUrl(updates.organization);
    assertSafeAdoUrl(cleaned); // Throws if insecure
    nextOrg = cleaned;
  }

  let nextProject = current.project;
  if (updates.project !== undefined) {
    const sanitizedProject = sanitizeText(updates.project).trim();
    if (sanitizedProject && !isValidProjectName(sanitizedProject)) {
      throw new Error("Project name contains invalid characters or exceeds length limit.");
    }
    nextProject = sanitizedProject;
  }

  let nextAgent = current.agent;
  if (updates.agent !== undefined) {
    const sanitizedAgent = sanitizeText(updates.agent).trim();
    if (sanitizedAgent && !isValidAgentName(sanitizedAgent)) {
      throw new Error("Agent runner must be a valid executable identifier (e.g. 'claude', 'cursor-agent').");
    }
    nextAgent = sanitizedAgent || "claude";
  }

  const next = {
    organization: nextOrg,
    project: nextProject,
    agent: nextAgent,
  };

  setShared(CONFIG_KEY, next);
  return next;
}

/**
 * Checks whether required configuration exists and passes security checks.
 * @returns {boolean}
 */
export function isConfigured() {
  const config = loadConfig();
  if (!config.organization || !config.project) return false;
  try {
    assertSafeAdoUrl(config.organization);
    return isValidProjectName(config.project);
  } catch {
    return false;
  }
}
