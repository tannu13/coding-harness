import { Command } from "commander";
import z from "zod";
import env from "../../env";

export const ModelsContentSchema = z.object({
  default: z.string().optional(),
  google: z.array(z.string()).optional(),
  openai: z.array(z.string()).optional(),
  anthropic: z.array(z.string()).optional(),
});

export const setModelsCommand = new Command("set")
  .description("Lets user set the default provider")
  .option(
    "-m, --model <modelName>",
    "Name of the model (gemini-flash-2.5, gemma-4-26b etc)",
    "",
  )
  .action(async (options) => {
    const modelName = options.model;
    if (!modelName) {
      console.error(
        `Model name is required for this command. Set it with -m or --model option`,
      );
      process.exit(1);
    }
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

    parsed.data["default"] = modelName;

    await modelFile.write(JSON.stringify(parsed.data));
  });
