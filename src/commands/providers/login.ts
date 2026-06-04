import fs from "node:fs";
import { Command } from "commander";
import z from "zod";

export const ValidProviderNames = z.enum(["google", "openai", "anthropic"]);
export const ApiKeySchema = z.object({
  apiKey: z.string(),
});
export const ProviderContentSchema = z.object({
  google: ApiKeySchema.optional(),
  openai: ApiKeySchema.optional(),
  anthropic: ApiKeySchema.optional(),
});
export const PROVIDER_FILE_PATH =
  "/home/tannu/.local/share/s30-tui-starter/providers.json";
export const loginCommand = new Command("login")
  .description("Lets user login into the provider (use it as default)")
  .option(
    "-p, --provider <providerName>",
    "Name of the provider (gemini, claude etc)",
    "",
  )
  .option("-a, --api_key <apiKey>", "Your api key", "")
  .action(async (options) => {
    const providerName = options.provider;
    const parsedProviderName = ValidProviderNames.safeParse(providerName);
    if (!parsedProviderName.success) {
      console.error(
        "Unsupported providers. Supported providers list given below:",
      );
      console.log(ValidProviderNames.options);
      process.exit(1);
    }
    const apiKey = options.api_key;
    // td::handle missing api_key
    if (!apiKey) {
      console.error("");
      console.error(`Missing API Key for "${parsedProviderName.data}"`);
      console.error("Provide it with an -a or --api_key flag");
      console.error("");
      return;
    }

    let providerFileContent = "{}";
    await fs.readFile(PROVIDER_FILE_PATH, async (err, data) => {
      if (err) {
        await fs.writeFile(PROVIDER_FILE_PATH, "{}", (err) => {
          console.error(err);
        });
      } else {
        providerFileContent = data.toString();
      }
      if (!providerFileContent) {
        providerFileContent = "{}";
      }
      const parsedContent = JSON.parse(providerFileContent);
      const parsed = ProviderContentSchema.safeParse(parsedContent);

      if (!parsed.success) {
        console.error(`Invalid provider file @ ${PROVIDER_FILE_PATH}`);
        console.error(parsed.error);
        process.exit(1);
      }

      parsed.data[parsedProviderName.data] = { apiKey };

      const res = await fs.writeFile(
        PROVIDER_FILE_PATH,
        JSON.stringify(parsed.data),
        (err) => {
          console.error(err);
        },
      );
    });
  });
