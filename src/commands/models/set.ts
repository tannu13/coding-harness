import fs from "node:fs";
import { Command } from "commander";
import z from "zod";

export const ModelsContentSchema = z.object({
  default: z.string().optional(),
  google: z.array(z.string()).optional(),
  openai: z.array(z.string()).optional(),
  anthropic: z.array(z.string()).optional(),
});

export const MODEL_FILE_PATH =
  "/home/tannu/.local/share/s30-tui-starter/models.json";

export const setModelsCommand = new Command("set")
  .description("Lets user set the default provider")
  .option(
    "-m, --model <modelName>",
    "Name of the model (gemini-flash-2.5, gemma-4-26b etc)",
    "",
  )
  .action(async (options) => {
    const modelName = options.model;

    let providerFileContent = "{}";
    await fs.readFile(MODEL_FILE_PATH, async (err, data) => {
      if (err) {
        await fs.writeFile(MODEL_FILE_PATH, "{}", (err) => {
          console.error(err);
        });
      } else {
        providerFileContent = data.toString();
      }
      if (!providerFileContent) {
        providerFileContent = "{}";
      }
      const parsedContent = JSON.parse(providerFileContent);
      const parsed = ModelsContentSchema.safeParse(parsedContent);

      if (!parsed.success) {
        console.error(`Invalid provider file @ ${MODEL_FILE_PATH}`);
        console.error(parsed.error);
        process.exit(1);
      }

      parsed.data["default"] = modelName;

      await fs.writeFile(
        MODEL_FILE_PATH,
        JSON.stringify(parsed.data),
        (err) => {
          console.error(err);
        },
      );
    });
  });
