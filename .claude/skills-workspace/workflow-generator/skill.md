---
name: workflow-generator
description: "YOU MUST USE THIS SKILL when the user wants to CREATE or BUILD a NEW workflow automation. Activate for requests like: 'create a workflow', 'build a workflow', 'generate a workflow', 'make a workflow', 'I want to automate', 'automate X to Y', 'schedule a task', 'monitor X and send to Y'. This skill creates workflows from simple YAML plans with automatic validation and import."
---

# Workflow Generator (Agent Workspace)

**Generate complete workflows from simple YAML plans via API - one call, zero errors.**

## ⚠️ CRITICAL: Use b0t API to Build Workflows

**NEVER manually write workflow JSON!** Create a YAML plan and call the b0t API:

```bash
curl -X POST http://localhost:3123/api/workflows/build-from-plan \
  -H "Content-Type: application/json" \
  -d '{"planPath": "plans/my-workflow.yaml"}'
```

**What the API does automatically (12-layer validation + auto-import):**
1. ✅ Validates modules exist in registry
2. ✅ Validates parameter names match signatures
3. ✅ Detects unsupported features (rest parameters, function-as-string)
4. ✅ Auto-wraps params/options functions
5. ✅ Builds workflow JSON
6. ✅ Validates schema structure
7. ✅ Validates trigger configuration (cron schedule, chat inputVariable)
8. ✅ Validates returnValue variable exists
9. ✅ Analyzes credential usage
10. ✅ Detects unused variables (dead code)
11. ✅ Runs dry-run test with mocks
12. ✅ **Automatically imports to database** (workflow appears in app immediately!)

**Result: If the API call succeeds, the workflow is LIVE in the b0t app. Zero runtime errors.**

---

## Process Overview

```
User Request → Ask Questions → Create YAML → Call API → Workflow Ready!
                      ↑                          ↑
              Clarify requirements    Auto build/validate/import
```

**3 Simple Steps:**
1. Ask clarifying questions (use AskUserQuestion tool)
2. Create plans/my-workflow.yaml (use Write tool)
3. Call API using Bash tool with curl command above

**The API automatically imports the workflow - no additional steps needed!**

---

## STEP 1: Ask Clarifying Questions

**ALWAYS start by asking questions using the AskUserQuestion tool.**

Ask the user to reference example plans in the `plans/` directory for structure guidance.
