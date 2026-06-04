import fs from "node:fs";
import { Command } from "commander";
import { MODEL_FILE_PATH, ModelsContentSchema } from "./set";

export const listCommand = new Command("list")
  .description("List all the providers supported")
  .action(async (options) => {
    let modelFileContent = "{}";
    await fs.readFile(MODEL_FILE_PATH, async (err, data) => {
      if (err) {
        await fs.writeFile(MODEL_FILE_PATH, "{}", (err) => {
          console.error(err);
        });
      } else {
        modelFileContent = data.toString();
      }
      if (!modelFileContent) {
        modelFileContent = "{}";
      }
      const parsedContent = JSON.parse(modelFileContent);
      const parsed = ModelsContentSchema.safeParse(parsedContent);

      if (!parsed.success) {
        console.error(`Invalid provider file @ ${MODEL_FILE_PATH}`);
        console.error(parsed.error);
        process.exit(1);
      }

      const availableModels: string[] = [];
      for (const [key, models] of Object.entries(parsed.data)) {
        if (key === "default") continue;
        availableModels.push(...models);
      }

      console.log("Available Models", availableModels);

      // await fs.writeFile(
      //   MODEL_FILE_PATH,
      //   JSON.stringify(parsed.data),
      //   (err) => {
      //     console.error(err);
      //   },
      // );
    });
  });
