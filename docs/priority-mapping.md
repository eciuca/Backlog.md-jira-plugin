# Priority Mapping Configuration

## Overview

The Backlog-Jira sync supports flexible priority mapping between Backlog and Jira, with defaults and project-specific overrides similar to status mapping. Mapping is case-insensitive for Jira names.

## Configuration Location

Priority mappings are defined in `.backlog-jira/config.json` under the `backlog.priorityMapping` key.

## Configuration Format

### Basic Configuration

```json
{
  "backlog": {
    "priorityMapping": {
      "backlogToJira": {
        "high": ["High", "Highest", "Critical", "Blocker"],
        "medium": ["Medium", "Major"],
        "low": ["Low", "Lowest", "Minor", "Trivial"]
      }
    }
  }
}
```

- Keys under `backlogToJira` are Backlog priorities (high, medium, low)
- Values are ordered arrays of acceptable Jira priority names; the first is used when pushing to Jira
- Jira → Backlog mapping is derived automatically (case-insensitive) from this list

### Project-Specific Overrides

For projects with custom priority schemes, define project-specific mappings:

```json
{
  "backlog": {
    "priorityMapping": {
      "backlogToJira": {
        "high": ["High"],
        "medium": ["Medium"],
        "low": ["Low"]
      },
      "projectOverrides": {
        "NCIS": {
          "backlogToJira": {
            "high": ["High"],
            "medium": ["Medium"],
            "low": ["Minor"]
          }
        }
      }
    }
  }
}
```

- Put the project key (e.g., `NCIS`) under `projectOverrides`
- Only `backlogToJira` is required; `jiraToBacklog` can be omitted and will be derived
- Matching is case-insensitive when reading Jira priorities

## Defaults

If `priorityMapping` is not configured, the plugin uses these defaults:

```json
{
  "high": ["High", "Highest", "Critical", "Blocker"],
  "medium": ["Medium", "Major"],
  "low": ["Low", "Lowest", "Minor", "Trivial"]
}
```

## Behavior

- Push (Backlog → Jira): the first Jira name in the mapped list is used for the project (or global list)
- Pull (Jira → Backlog): Jira priority names are matched case-insensitively to derive Backlog priority
- If no mapping is found for a Jira name, Backlog priority defaults to `medium` and a warning is logged

## Tips

- Prefer listing the exact Jira names used by your project first
- Use project overrides for projects that lack standard priorities like "Low"
- You can test without side effects using `backlog-jira push --dry-run`