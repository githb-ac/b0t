b0t Workflow Engine and Schema

Overview
- b0t is a Next.js 15/React 19 automation app with a modular TypeScript workflow engine and 140+ service integrations.
- Core locations:
  - src/app: App Router pages, API routes, streaming endpoints
  - src/components: UI (workflows, credentials, clients)
  - src/lib: Core services (auth, db, queue, scheduler, workflow engine)
  - src/lib/workflows: Engine (executor, parallelization, schema, validator, registry)
  - src/modules: Integrations and utilities organized by domain (ai, social, data, utilities, etc.)
  - scripts: CLI utilities (generate registry, import/test workflows)
  - worker.ts: Dedicated BullMQ worker + cron scheduler
  - tests: Vitest suite (engine/unit tests)

How workflows are defined
- Storage: Workflows are persisted in PostgreSQL table workflows (src/lib/schema.ts) with JSON-serialized config and trigger.
- Import/export: src/lib/workflows/import-export.ts provides JSON import/export. POST /api/workflows/import accepts workflowJson and persists it. POST /api/workflows/execute-test imports, runs, and deletes the workflow for local testing.
- Schema version: version is currently "1.0".

Execution path
- Workflows run through src/lib/workflows/executor.ts (or executor-stream.ts for progress streaming).
- Steps are normalized (control-flow aware) and executed with automatic parallelization:
  - Dependency analysis (src/lib/workflows/parallel-executor.ts) extracts {{var}} references from inputs/conditions and builds a DAG.
  - Steps are grouped into waves with no mutual dependencies and executed in parallel (max concurrency per wave is configurable with MAX_WAVE_CONCURRENCY, default 10).
  - Sequential waves respect dependencies.
- A step is executed by resolveVariables + executeModuleFunction:
  - Variable resolution supports {{var}}, {{var.prop}}, {{var[0].prop}} and inline interpolation inside strings.
  - executeModuleFunction dynamically imports a module file based on module path category.module.function and maps inputs to the function’s signature (supports object params, alias mapping, positional fallback).
- Built-ins and context:
  - Built-in variables: user, credential, trigger, workflowId.
  - Step outputs are stored under outputAs and become available to later steps.
  - Final output: if config.returnValue set, it’s resolved and returned; otherwise the engine returns a filtered view of context.variables (excluding credentials and internal variables).
- Persistence of runs: workflow_runs table tracks status, timing, output, error, and errorStep. executor.ts updates the run atomically.

Control flow and iteration
- Control flow constructs live in src/lib/workflows/control-flow.ts and are supported by the executor even though they are not included in the JSON Schema used by AJV.
  - Action step:
    { "type": "action", id, module, inputs, outputAs? }
  - Condition step (if/else):
    { "type": "condition", id, "condition": "{{var}} === 'value'", then: WorkflowStep[], else?: WorkflowStep[] }
  - For-each loop:
    { "type": "forEach", id, "array": "{{items}}", itemAs, indexAs?, steps: WorkflowStep[] }
  - While loop:
    { "type": "while", id, "condition": "{{counter}} < 5", maxIterations?, steps: WorkflowStep[] }
- Expressions are evaluated by safely serializing {{...}} to literal values, then running new Function(`return ${expr}`) for boolean conditions. Supported operators: ===, !==, >, <, >=, <=, &&, ||.

Templating, variables, and data flow
- Templating: Mustache-like tags {{...}} can reference full values or be inlined within strings. Dot and bracket access are supported.
- Declaring variables: Use outputAs to declare a variable name for a step’s output; later steps should reference that variable (e.g., {{sum}}). Referencing raw step IDs is only used for dependency detection and is not populated into variables.
- Built-in namespaces:
  - user: authenticated user info and decrypted credentials
  - credential: alias to credentials only (e.g., {{credential.openai_api_key}})
  - trigger: data injected by the triggering mechanism (webhook payloads, chat input values, etc.)
  - workflowId: current workflow identifier available for workflow-scoped storage

Triggers and scheduler
- Trigger field shape: { type: 'manual' | 'cron' | 'webhook' | 'telegram' | 'discord' | 'chat' | 'chat-input', config: {} }
- Cron scheduling is handled by src/lib/workflows/workflow-scheduler.ts with Redis-based leader election for distributed workers. Scheduled fire → queue (if Redis available) or direct execution fallback.
- Real-time progress is available via executor-stream.ts and GET/POST routes under src/app/api/workflows/[id]/*.

Queues and concurrency
- Per-organization BullMQ queues (src/lib/workflows/workflow-queue.ts) isolate load and apply rate limits. Redis is required in production; missing Redis falls back to direct execution.
- worker.ts preloads modules and user credentials and then boots the queue workers and scheduler.

Validation and schema
- Primary JSON Schema used for structure: src/lib/workflows/workflow-schema.ts. Validated via AJV in src/lib/workflows/workflow-validator.ts.
- Additional validations:
  - validateModulePaths ensures category.module.function exists in the module registry.
  - validateVariableReferences checks outputAs declarations vs references.
  - AI SDK usage checks enforce options wrapper and presence of apiKey/model/prompt/messages.
  - Storage module checks enforce params wrapper and workflowId for workflow-scoped tables.
- Note: Control-flow step types (condition/forEach/while) are supported at runtime but are not encoded in the AJV schema items (which require id/module/inputs). Use the executor directly or relax structural validation if you include control flow.

Module registry and modules
- Registry source: src/lib/workflows/module-registry.ts (auto-generated by scripts/generate-module-registry.ts). Paths are category.module.function and map to src/modules/<category>/<module>.ts.
- Categories map loosely to folders (e.g., utilities → src/modules/utilities, social media → src/modules/social). The executor has a CATEGORY_FOLDER_MAP to normalize names with/without spaces.
- Typical no-credential utility modules: utilities.math, utilities.datetime, utilities.string-utils, utilities.json-transform, etc.
- Data persistence helpers: data.drizzle-utils exposes queryWhereIn, insertRecord, updateRecord, deleteRecord with automatic workflow-scoped table names via workflowId.

AI adapters and credentials
- AI SDK module (src/modules/ai/ai-sdk.ts) wraps Vercel AI SDK with providers: OpenAI, Anthropic, OpenRouter. Functions include generateText, chat, streamGeneration, generateJSON plus convenience helpers.
- Model catalog is defined in src/lib/ai-models.ts with helper utilities.
- Auto-injection of API keys: executor injects apiKey into AI SDK options when not provided, based on model or explicit provider, pulling from credentials loaded for the user.
- Credentials loading: loadUserCredentials (executor.ts) merges OAuth tokens (with refresh) and API keys from user_credentials, caches in Redis and in-memory, and exposes them under both user and credential namespaces with platform aliases.

Database schema (relevant tables)
- workflows: id, userId, organizationId, name, description, prompt, config, trigger, status, organizationStatus, lastRun*, runCount
- workflow_runs: id, workflowId, userId, organizationId, status, triggerType, triggerData, startedAt, completedAt, duration, output, error, errorStep
- user_credentials: platform, name, encryptedValue, metadata (multi-field credentials), lastUsed
- chat_conversations/chat_messages: chat triggers & conversations

Workflow JSON schema reference (concise)
- File: src/lib/workflows/workflow-schema.ts
- Key fields:
  - version: "1.0"
  - name: string (1-100 chars)
  - description: string (1-500 chars)
  - trigger?: { type: enum, config: object }
  - config: {
      steps: Array<{
        id: string (^[a-zA-Z0-9_-]+$),
        module: string (^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9]*$),
        inputs: object,
        outputAs?: string (^[a-zA-Z_][a-zA-Z0-9_]*$)
      }>,
      returnValue?: string (must be {{...}}),
      outputDisplay?: { type: table|list|text|markdown|json|image|images|chart, columns?: [...] }
    }
  - metadata?: { author?: string, created?: date-time, tags?: string[], category?: string, requiresCredentials?: string[] }
- Trigger sub-schemas: chat-input (fields[]), cron (schedule pattern), chat (inputVariable)

Example minimal workflow JSON (no credentials required)
{
  "version": "1.0",
  "name": "Add two numbers",
  "description": "Compute 2 + 2 using utilities.math.add and return the sum.",
  "trigger": { "type": "manual", "config": {} },
  "config": {
    "steps": [
      {
        "id": "add",
        "module": "utilities.math.add",
        "inputs": { "a": 2, "b": 2 },
        "outputAs": "sum"
      }
    ],
    "returnValue": "{{sum}}",
    "outputDisplay": { "type": "json" }
  }
}

Run the example locally
- Option A (HTTP): POST to /api/workflows/execute-test with body { workflowJson: '<stringified JSON above>' }. Returns success, output, and timing. Only available in development.
- Option B (CLI): Save JSON to a file (e.g., example.workflow.json) and run:
  - npx tsx scripts/test-workflow.ts example.workflow.json
  - For a dry-run (no execution): npx tsx scripts/test-workflow.ts example.workflow.json --dry-run

Templating and iteration examples
- Inline templating:
  - inputs: { message: "The sum is {{sum}}" }
- For-each loop:
  {
    "type": "forEach",
    "id": "loop",
    "array": "{{items}}",
    "itemAs": "item",
    "steps": [
      { "type": "action", "id": "square", "module": "utilities.math.multiply", "inputs": { "a": "{{item}}", "b": 2 }, "outputAs": "doubles" }
    ]
  }
- Condition:
  { "type": "condition", "id": "check", "condition": "{{sum}} === 4", "then": [ { "type": "action", "id": "ok", "module": "utilities.string-utils.concat", "inputs": { "arr": ["OK: ", "{{sum}}"] }, "outputAs": "msg" } ] }

Notes, gaps, and integration considerations (KIE.ai / MCP)
- Control-flow steps are runtime-supported but not included in the AJV structural schema; importing such workflows via strict structure validation will fail unless validation is relaxed or steps are imported via executor-only paths. Recommendation: add an extended schema that unions ActionStep with control-flow variants, or validate with a separate pass.
- Module inputs/outputs are not uniformly typed at runtime. The auto-generated module registry includes function signatures and brief descriptions but not Zod runtime schemas per function. Recommendation: progressively add Zod schemas to critical modules.
- Parameter mapping in executeModuleFunction relies on signature parsing and alias heuristics; uncommon parameter names may require wrapping inputs under a params or options object to guarantee matching.
- AI SDK steps require an options wrapper; executor can auto-inject apiKey from credentials based on provider/model. Documenting this for workflow authors avoids confusion.
- MCP: src/lib/mcp provides client + tool adapters; integrating MCP tools as workflow steps likely goes through the ai-agent/ai-tools layer today. For KIE.ai/getmcp conversion, plan how MCP tools are referenced (naming, credential mapping) and whether they appear as modules or AI tools.
- Storage: data.drizzle-utils uses the app DB and can create workflow-scoped tables dynamically. Ensure workflowId is passed as {{workflowId}} when using storage helpers to avoid conflicts.

See also
- Module registry: docs/module-registry.md and src/lib/workflows/module-registry.ts
- Validator: src/lib/workflows/workflow-validator.ts
- Scheduler: src/lib/workflows/workflow-scheduler.ts
- Queue: src/lib/workflows/workflow-queue.ts
- AI models/providers: src/lib/ai-models.ts; modules/ai/ai-sdk.ts
