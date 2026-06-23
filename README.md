# coding-harness

A Bun + TypeScript CLI for running a local coding-agent harness.

The harness lets a user configure provider credentials and model settings, then
send a prompt to an agent. The agent runs in a bounded loop, can request tools,
receives structured tool results, and stops when it produces a final response or
hits the iteration guardrail.

## What It Does

- Configures provider API keys for `google`, `openai`, and `anthropic`.
- Stores model configuration locally and lets users select a default model.
- Runs an agent loop with model calls, tool calls, validation, and tool results.
- Exposes a tool registry for adding local capabilities.
- Supports lifecycle hooks for custom policy, logging, approvals, and telemetry.
- Includes guardrails for max loop iterations, schema validation, unsupported
  tools, rejected tool calls, and bounded context.
- Manages conversation context with configurable context strategies.

## Requirements

- [Bun](https://bun.sh)
- TypeScript 5
- A provider API key for the model you want to use

Install dependencies:

```bash
bun install
```

Run the CLI:

```bash
bun run src/cli.ts --help
```

For development with watch mode:

```bash
bun run dev
```

Run tests:

```bash
bun test
```

## Quick Start

1. Add a provider API key:

```bash
bun run src/cli.ts providers login --provider google --api-key "$GOOGLE_API_KEY"
```

2. Add model/provider mappings in the model config file:

```json
{
  "google": ["gemini-2.5-flash"],
  "default": "gemini-2.5-flash"
}
```

3. Or update only the default model with the CLI:

```bash
bun run src/cli.ts models set --model gemini-2.5-flash
```

4. Run the agent:

```bash
bun run src/cli.ts agent --prompt "Read README.md and summarize the project"
```

## CLI Commands

### Root

```bash
coding-harness [command]
```

Options:

- `-V, --version`: print CLI version.
- `-h, --help`: print help.

Commands:

- `providers`: manage provider credentials.
- `models`: inspect and select model configuration.
- `agent`: run the coding-agent loop.

### `providers`

Manage API keys stored in the local provider config file.

```bash
bun run src/cli.ts providers list
```

Prints supported provider names:

- `google`
- `openai`
- `anthropic`

```bash
bun run src/cli.ts providers login --provider <providerName> --api-key <apiKey>
```

Options:

- `-p, --provider <providerName>`: provider to configure. Must be one of
  `google`, `openai`, or `anthropic`.
- `-a, --api-key <apiKey>`: API key for that provider.

```bash
bun run src/cli.ts providers logout --provider <providerName>
```

Options:

- `-p, --provider <providerName>`: provider to remove from local config.

### `models`

Inspect and select models.

```bash
bun run src/cli.ts models list
```

Prints all models present in the configured provider model arrays.

```bash
bun run src/cli.ts models set --model <modelName>
```

Options:

- `-m, --model <modelName>`: model to use as the default model.

The agent chooses the provider by finding which provider model list contains the
default model.

### `agent`

Run the agent loop.

```bash
bun run src/cli.ts agent --prompt <prompt>
```

Options:

- `-p, --prompt <prompt>`: required user prompt for the agent.
- `--context-strategy <strategy>`: context strategy. Supported values:
  `none`, `truncate-oldest`, `summarize-old-history`.
- `--context-max-turns <number>`: maximum recent messages to keep with the
  initial prompt. Defaults to `8`.
- `--context-token-budget <number>`: approximate token budget metadata value.

Defaults:

- Context strategy: `truncate-oldest`
- Recent message count: `8`
- Max harness iterations: `5`

Note: `summarize-old-history` is accepted by the CLI parser but is not
implemented by `ContextManager` yet.

## Local Config Files

The CLI reads config file locations from environment variables. See
[.env.example](/home/tannu/Documents/personal/js/coding-harness/.env.example):

```text
MODEL_FILE_PATH=/~/.local/share/coding-harness/models.json
PROVIDER_FILE_PATH=/~/.local/share/coding-harness/providers.json
```

`MODEL_FILE_PATH` points to the model config file. `PROVIDER_FILE_PATH` points
to the provider credentials file.

Provider config schema:

```json
{
  "google": {
    "apiKey": "..."
  },
  "openai": {
    "apiKey": "..."
  },
  "anthropic": {
    "apiKey": "..."
  }
}
```

Model config schema:

```json
{
  "default": "gemini-2.5-flash",
  "google": ["gemini-2.5-flash"],
  "openai": ["gpt-4.1"],
  "anthropic": ["claude-sonnet-4"]
}
```

`models set` only updates the `default` field. Add provider model lists directly
to `models.json` until a dedicated model-registration command exists.

## Agent Loop

The loop is implemented by `Harness`:

1. Read raw conversation history from the `Agent`.
2. Build managed context with `ContextManager`.
3. Run `pre-llm-call` hooks.
4. Call the model with registered tool declarations.
5. If the model requests tools:
   - validate the tool name is registered,
   - validate arguments with the tool's Zod schema,
   - run `pre-tool-call` hooks,
   - execute approved tools,
   - send structured tool responses back to the model.
6. If the model does not request tools, print the final response and usage
   metadata.
7. Stop after a final response or the max-iteration guardrail.

## Tools

Tools are registered through `ToolRegistry`.

Built-in tools:

- `readFile`
  - Args: `{ "path": "string" }`
  - Purpose: read file content by path.
- `writeFile`
  - Args: `{ "path": "string", "content": "string" }`
  - Purpose: write or overwrite file content by path.

Current implementation note: these tools are scaffolded examples. They validate
arguments and return structured results, but file I/O behavior is still stubbed.

## Hooks

Hooks are registered with `HooksRegistry` and receive typed context objects.

Supported hook points:

- `pre-llm-call`: runs before each model call.
  - Receives raw history, managed history, and context metadata.
- `pre-tool-call`: runs before a tool executes.
  - Receives history, tool name, parsed args, `approve()`, and `reject(reason)`.
- `post-tool-call`: intended for work after a tool executes.
  - Receives history, tool name, and result.
- `no-tool-calls-remaining`: intended for work when the model returns a final
  answer instead of tool calls.
  - Receives history.

`pre-llm-call` and `pre-tool-call` are currently wired into the harness.
`post-tool-call` and `no-tool-calls-remaining` are defined extension points but
are not wired yet.

The current `agent` command registers a sample `pre-tool-call` guardrail hook
that rejects tool calls. Remove or replace `ValidateToolCallHook` when you want
normal tool execution.

## Guardrails

The harness includes these safety checks:

- Provider name validation against supported providers.
- Provider and model config validation with Zod.
- Required default model before running the agent.
- Provider API key check for the selected model provider.
- Tool lookup before execution.
- Tool argument validation before execution.
- Hook-based tool rejection through `pre-tool-call`.
- Structured error response when a tool call is rejected.
- Max iteration limit to prevent unbounded agent loops.
- Context truncation to avoid sending unbounded history.

## Context Management

`ContextManager` keeps raw run history separate from the context sent to the
model.

Supported strategies:

- `none`: send full raw history.
- `truncate-oldest`: preserve the initial prompt and keep the latest messages.
- `summarize-old-history`: planned, currently not implemented.

Context metadata includes:

- raw message count
- managed message count
- dropped message count
- approximate token count
- selected strategy

The approximate token count is estimated locally from text length and serialized
non-text parts.

## Project Structure

```text
src/cli.ts                         CLI command assembly
src/commands/agent.ts              agent command and runtime setup
src/commands/providers/*           provider config commands
src/commands/models/*              model config commands
src/services/agent.ts              model client and conversation history
src/services/harness.ts            agent loop and tool execution
src/services/tools.ts              tool definitions and registry
src/services/hooks.ts              hook types and registry
src/services/context-manager.ts    context management strategies
```

## Current Limitations

- The runtime model client is currently Google GenAI based, even though config
  schemas include OpenAI and Anthropic.
- Built-in file tools are stubbed and do not yet perform real workspace file
  reads/writes.
- Model provider arrays must be edited in `models.json`; the CLI only sets the
  default model.
- `summarize-old-history`, `post-tool-call`, and `no-tool-calls-remaining` are
  defined but not fully implemented.
