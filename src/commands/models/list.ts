import { Command } from "commander";
import { ModelsContentSchema } from "./set";
import env from "../../env";

export const listCommand = new Command("list")
  .description("List all the providers supported")
  .action(async () => {
    const modelFile = Bun.file(env.MODEL_FILE_PATH);
    if (!(await modelFile.exists())) {
      await modelFile.write("{}");
    }

    const data = await modelFile.json();
    const parsed = ModelsContentSchema.safeParse(data);
    if (!parsed.success) {
      console.error(`Invalid provider file @ ${env.MODEL_FILE_PATH}`);
      console.error(parsed.error);
      process.exit(1);
    }

    const availableModels: string[] = [];
    for (const [key, models] of Object.entries(parsed.data)) {
      if (key === "default") continue;
      availableModels.push(...models);
    }

    console.log("Available Models", availableModels);
  });
