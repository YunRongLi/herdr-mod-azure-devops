import { shared, setShared } from "herdr";
import { assertSafeAdoUrl, isValidAgentName, sanitizeText, extractOrgName } from "./utils.js";

const CONFIG_KEY = "azure-devops.config";

/**
 * @typedef {Object} AdoProfile
 * @property {string} id Unique profile identifier
 * @property {string} name Friendly display name (e.g., "OrgAlpha / ProjectA")
 * @property {string} organization Organization URL (https://dev.azure.com/org)
 * @property {string} project Project name
 */

/**
 * @typedef {Object} AdoConfig
 * @property {Array<AdoProfile>} profiles Configured ADO targets
 * @property {string} activeProfileId Active profile ID
 * @property {string} agent Default coding agent executable name
 */

/**
 * Normalizes and validates an organization URL.
 * @param {string} url
 * @returns {string}
 */
export function cleanOrgUrl(url) {
  if (!url) return "";
  let cleaned = url.trim();
  while (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  if (cleaned.startsWith("http://")) {
    cleaned = "https://" + cleaned.slice(7);
  } else if (!cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned;
  }
  return cleaned;
}

/**
 * Validates project name.
 * @param {string} project
 * @returns {boolean}
 */
export function isValidProjectName(project) {
  if (!project || typeof project !== "string") return false;
  const trimmed = project.trim();
  return /^[a-zA-Z0-9_\-\. ]{1,64}$/.test(trimmed) && !trimmed.includes("..");
}

/**
 * Generates a clean display name if none is provided.
 * @param {string} orgUrl
 * @param {string} project
 * @returns {string}
 */
export function defaultProfileName(orgUrl, project) {
  const org = extractOrgName(orgUrl) || "Org";
  return `${org} / ${project}`;
}

/**
 * Retrieves the full configuration from Herdr shared state.
 * Automatically migrates single-profile legacy configs into the multi-profile structure.
 *
 * @returns {AdoConfig}
 */
export function loadConfig() {
  const stored = shared(CONFIG_KEY);

  let profiles = [];
  let activeProfileId = "";
  let agent = "claude";

  if (stored && typeof stored === "object") {
    if (typeof stored.agent === "string" && isValidAgentName(stored.agent)) {
      agent = stored.agent.trim();
    }

    if (Array.isArray(stored.profiles) && stored.profiles.length > 0) {
      profiles = stored.profiles
        .filter((p) => p && typeof p === "object" && p.organization && p.project)
        .map((p, idx) => ({
          id: String(p.id || `prof-${idx + 1}`),
          name: sanitizeText(p.name || defaultProfileName(p.organization, p.project)).trim(),
          organization: cleanOrgUrl(p.organization),
          project: sanitizeText(p.project).trim(),
        }));
      activeProfileId = String(stored.activeProfileId || (profiles[0] ? profiles[0].id : ""));
    } else if (stored.organization && stored.project) {
      // Legacy migration from single-profile structure
      const org = cleanOrgUrl(stored.organization);
      const proj = sanitizeText(stored.project).trim();
      const legacyProfile = {
        id: "default",
        name: defaultProfileName(org, proj),
        organization: org,
        project: proj,
      };
      profiles = [legacyProfile];
      activeProfileId = "default";
    }
  }

  // Ensure activeProfileId matches an existing profile
  if (profiles.length > 0 && !profiles.some((p) => p.id === activeProfileId)) {
    activeProfileId = profiles[0].id;
  }

  return { profiles, activeProfileId, agent };
}

/**
 * Persists the configuration into Herdr shared state.
 * @param {AdoConfig} next
 * @returns {AdoConfig}
 */
export function saveConfig(next) {
  setShared(CONFIG_KEY, next);
  return next;
}

/**
 * Retrieves the currently active profile.
 * @returns {AdoProfile | null}
 */
export function getActiveProfile() {
  const config = loadConfig();
  if (config.profiles.length === 0) return null;
  return config.profiles.find((p) => p.id === config.activeProfileId) || config.profiles[0];
}

/**
 * Switches the active profile and persists to state.
 * @param {string} profileId
 * @returns {AdoProfile | null}
 */
export function setActiveProfile(profileId) {
  const config = loadConfig();
  const found = config.profiles.find((p) => p.id === profileId);
  if (!found) return null;

  config.activeProfileId = profileId;
  saveConfig(config);
  return found;
}

/**
 * Adds a new profile to configuration.
 *
 * @param {Object} params
 * @param {string} [params.name]
 * @param {string} params.organization
 * @param {string} params.project
 * @param {boolean} [params.setAsActive=true]
 * @returns {AdoProfile}
 */
export function addProfile({ name, organization, project, setAsActive = true }) {
  const config = loadConfig();
  const cleanedOrg = cleanOrgUrl(organization);
  assertSafeAdoUrl(cleanedOrg);

  const sanitizedProject = sanitizeText(project).trim();
  if (!isValidProjectName(sanitizedProject)) {
    throw new Error("Project name contains invalid characters. Use letters, numbers, spaces, and hyphens.");
  }

  const id = `prof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const label = sanitizeText(name || defaultProfileName(cleanedOrg, sanitizedProject)).trim();

  const newProfile = {
    id,
    name: label,
    organization: cleanedOrg,
    project: sanitizedProject,
  };

  config.profiles.push(newProfile);
  if (setAsActive || config.profiles.length === 1) {
    config.activeProfileId = id;
  }

  saveConfig(config);
  return newProfile;
}

/**
 * Removes a profile by ID.
 * @param {string} profileId
 * @returns {boolean}
 */
export function removeProfile(profileId) {
  const config = loadConfig();
  const index = config.profiles.findIndex((p) => p.id === profileId);
  if (index === -1) return false;

  config.profiles.splice(index, 1);
  if (config.activeProfileId === profileId) {
    config.activeProfileId = config.profiles.length > 0 ? config.profiles[0].id : "";
  }

  saveConfig(config);
  return true;
}

/**
 * Updates agent runner setting.
 * @param {string} agentName
 */
export function setAgentRunner(agentName) {
  const config = loadConfig();
  if (isValidAgentName(agentName)) {
    config.agent = agentName.trim();
    saveConfig(config);
  }
}

/**
 * Checks whether at least one valid profile is configured.
 * @returns {boolean}
 */
export function isConfigured() {
  const active = getActiveProfile();
  if (!active || !active.organization || !active.project) return false;
  try {
    assertSafeAdoUrl(active.organization);
    return isValidProjectName(active.project);
  } catch {
    return false;
  }
}
