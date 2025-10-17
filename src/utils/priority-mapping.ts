import { readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.ts";

/**
 * Valid Backlog.md priority values
 */
export type BacklogPriority = "high" | "medium" | "low";

export interface PriorityMappingConfig {
  // Maps Backlog priorities (high|medium|low) to arrays of acceptable Jira priority names
  backlogToJira: Record<string, string[]>;
  // Reverse map: Jira priority name -> Backlog priority
  jiraToBacklog: Record<string, BacklogPriority>;
  // Project-specific overrides (optional)
  projectOverrides?: Record<
    string,
    {
      backlogToJira: Record<string, string[]>;
      jiraToBacklog?: Record<string, BacklogPriority>;
    }
  >;
}

/**
 * Load priority mapping configuration from .backlog-jira/config.json
 * Structure:
 *   backlog.priorityMapping.backlogToJira: { high: ["High", ...], medium: ["Medium", ...], low: ["Low", ...] }
 *   backlog.priorityMapping.projectOverrides?: { PROJ: { backlogToJira: {...}, jiraToBacklog?: {...} } }
 */
export function loadPriorityMapping(): PriorityMappingConfig {
  try {
    const configPath = join(process.cwd(), ".backlog-jira", "config.json");
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);

    const pm = config.backlog?.priorityMapping;

    // Build base mapping
    const baseBacklogToJira: Record<string, string[]> =
      pm?.backlogToJira || getDefaultBacklogToJiraPriorityMapping();

    // Build reverse map (case-insensitive keys)
    const jiraToBacklog: Record<string, BacklogPriority> = {};
    for (const [backlogPriority, jiraNames] of Object.entries(baseBacklogToJira)) {
      for (const name of jiraNames) {
        jiraToBacklog[name.toLowerCase()] = normalizeBacklogPriority(backlogPriority);
      }
    }

    // Normalize project overrides if any
    const overrides: PriorityMappingConfig["projectOverrides"] = {};
    if (pm?.projectOverrides && typeof pm.projectOverrides === "object") {
      for (const [proj, override] of Object.entries(pm.projectOverrides as Record<string, { backlogToJira: Record<string, string[]>; jiraToBacklog?: Record<string, string> }>)) {
        const oBacklogToJira: Record<string, string[]> = {};
        for (const [k, arr] of Object.entries(override.backlogToJira || {})) {
          oBacklogToJira[normalizeBacklogPriority(k)] = (arr || []).slice();
        }
        const oJiraToBacklog: Record<string, BacklogPriority> = {};
        // If given explicitly, normalize to lower-case keys; else derive from oBacklogToJira
        const given = override.jiraToBacklog || {};
        if (Object.keys(given).length > 0) {
          for (const [jiraName, back] of Object.entries(given)) {
            oJiraToBacklog[jiraName.toLowerCase()] = normalizeBacklogPriority(back);
          }
        } else {
          for (const [back, names] of Object.entries(oBacklogToJira)) {
            for (const name of names) {
              oJiraToBacklog[name.toLowerCase()] = normalizeBacklogPriority(back);
            }
          }
        }
        overrides[proj] = { backlogToJira: oBacklogToJira, jiraToBacklog: oJiraToBacklog };
      }
    }

    return {
      backlogToJira: normalizeBacklogToJiraKeys(baseBacklogToJira),
      jiraToBacklog,
      projectOverrides: Object.keys(overrides).length ? overrides : undefined,
    };
  } catch (error) {
    logger.warn({ error }, "Failed to load priority mapping config, using defaults");
    const base = getDefaultBacklogToJiraPriorityMapping();
    const rev: Record<string, BacklogPriority> = {};
    for (const [b, names] of Object.entries(base)) {
      for (const n of names) rev[n.toLowerCase()] = normalizeBacklogPriority(b);
    }
    return {
      backlogToJira: normalizeBacklogToJiraKeys(base),
      jiraToBacklog: rev,
    };
  }
}

function normalizeBacklogPriority(p: string): BacklogPriority {
  const v = p.toLowerCase().trim();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}

function normalizeBacklogToJiraKeys(src: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(src)) out[normalizeBacklogPriority(k)] = v.slice();
  return out;
}

/**
 * Default Backlog → Jira priority mapping (ordered by preference)
 */
function getDefaultBacklogToJiraPriorityMapping(): Record<string, string[]> {
  return {
    high: ["High", "Highest", "Critical", "Blocker"],
    medium: ["Medium", "Major"],
    low: ["Low", "Lowest", "Minor", "Trivial"],
  };
}

/**
 * Map Jira priority to Backlog.md priority (case-insensitive), with optional project override
 */
export function mapJiraPriorityToBacklog(
  jiraPriority: string | undefined,
  projectKey?: string,
): BacklogPriority | undefined {
  if (!jiraPriority) return undefined;

  const normalized = jiraPriority.toLowerCase().trim();
  const mapping = loadPriorityMapping();

  // Prefer project override if available
  if (projectKey && mapping.projectOverrides?.[projectKey]?.jiraToBacklog) {
    const projMap = mapping.projectOverrides[projectKey]!.jiraToBacklog!;
    const mapped = projMap[normalized];
    if (mapped) {
      logger.debug({ jiraPriority, backlogPriority: mapped, projectKey }, "Mapped Jira priority to Backlog (project override)");
      return mapped;
    }
  }

  const mapped = mapping.jiraToBacklog[normalized];
  if (mapped) {
    logger.debug({ jiraPriority, backlogPriority: mapped }, "Mapped Jira priority to Backlog");
    return mapped;
  }

  logger.warn({ jiraPriority }, `Unknown Jira priority "${jiraPriority}", defaulting to medium`);
  return "medium";
}

/**
 * Map Backlog.md priority to Jira priority (selects first acceptable name), with optional project override
 */
export function mapBacklogPriorityToJira(
  backlogPriority: string | undefined,
  projectKey?: string,
): string | undefined {
  if (!backlogPriority) return undefined;

  const normalized = normalizeBacklogPriority(backlogPriority);
  const mapping = loadPriorityMapping();

  let candidates: string[] | undefined;

  if (projectKey && mapping.projectOverrides?.[projectKey]) {
    candidates = mapping.projectOverrides[projectKey]!.backlogToJira[normalized];
  }
  if (!candidates) {
    candidates = mapping.backlogToJira[normalized];
  }

  if (!candidates || candidates.length === 0) {
    logger.warn({ backlogPriority }, `No Jira priority mapping configured for Backlog priority "${backlogPriority}", defaulting to Medium`);
    return "Medium";
  }

  const chosen = candidates[0];
  logger.debug({ backlogPriority: normalized, jiraPriority: chosen, projectOverride: !!(projectKey && mapping.projectOverrides?.[projectKey]) }, "Mapped Backlog priority to Jira");
  return chosen;
}
