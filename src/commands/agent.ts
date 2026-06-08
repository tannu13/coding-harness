import fs from "node:fs";
import { Command } from "commander";
import { readFileTool, ToolRegistry, writeFileTool } from "../services/tools";
import { Agent } from "../services/agent";
import { Harness } from "../services/harness";
import { MODEL_FILE_PATH, ModelsContentSchema } from "./models/set";
import env from "../env";
import {
  PROVIDER_FILE_PATH,
  ProviderContentSchema,
  type TValidProviderNames,
} from "./providers/login";
import {
  HooksRegistry,
  type Hook,
  type HookContextMap,
} from "../services/hooks";

class ValidateToolCallHook implements Hook<"pre-tool-call"> {
  name: string = "validate-tool-call";
  process(context: HookContextMap["pre-tool-call"]) {
    console.log(context);
    context.reject("Rejecting tool calling as system is experience outage.");
  }
}

export const agentCommand = new Command("agent")
  .description("Runs the agent")
  .option("-p, --prompt <prompt>", "prompt", "")
  .action(async (options) => {
    console.log("User prompt is ..." + options.prompt);

    if (!options.prompt) {
      console.error(
        "Please provide a provide for the agent using -p or --prompt flag",
      );
      process.exit(1);
    }

    const modelFile = Bun.file(MODEL_FILE_PATH);
    if (!(await modelFile.exists())) {
      await modelFile.write("{}");
    }

    const data = await modelFile.json();
    const parsed = ModelsContentSchema.safeParse(data);
    if (!parsed.success) {
      console.error(`Invalid provider file @ ${MODEL_FILE_PATH}`);
      console.error(parsed.error);
      process.exit(1);
    }

    if (!parsed.data["default"]) {
      console.error("There is no default model set.");
      console.error("Set it with `models set -m <MODEL_NAME>`");
      console.error(parsed.error);
      process.exit(1);
    }

    const model = parsed.data["default"];
    let selectedEnterprise: TValidProviderNames | undefined;
    for (const [enterpriseKey, models] of Object.entries(parsed.data)) {
      if (enterpriseKey === "default") continue;
      if (models.includes(model)) {
        selectedEnterprise = enterpriseKey as TValidProviderNames;
        break;
      }
    }

    if (!selectedEnterprise) {
      console.error(
        "There's no valid enterprise selected for the default model.",
      );
      process.exit(1);
    }

    const providerFile = Bun.file(PROVIDER_FILE_PATH);
    if (!(await providerFile.exists())) {
      console.error(
        "There aren't any providers setup. Use `providers login` command",
      );
      process.exit(1);
    }
    const providerData = await providerFile.json();
    const parsedProviders = ProviderContentSchema.safeParse(providerData);

    if (!parsedProviders.success) {
      console.error(`Invalid provider file @ ${PROVIDER_FILE_PATH}`);
      console.error(parsedProviders.error);
      process.exit(1);
    }

    if (!parsedProviders.data[selectedEnterprise]?.apiKey) {
      console.error(`API KEY not set the default model's provider`);
      process.exit(1);
    }
    const { apiKey } = parsedProviders.data[selectedEnterprise]!;

    const tools = new ToolRegistry();
    tools.register(readFileTool).register(writeFileTool);

    // const userPrompt =
    //   "Read './rainbow.txt' and write a summary to rainbow-summary.txt in 50 chars.";

    // td:: the api key should be the one what user gave not the one from env

    console.log(apiKey, model);

    const agent = new Agent(apiKey, options.prompt, model);

    const hooks = new HooksRegistry();
    const validateHook = new ValidateToolCallHook();
    hooks.register("pre-tool-call", validateHook);

    const harness = new Harness(agent, tools, hooks);
    await harness.executeTask();
  });
