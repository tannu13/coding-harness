import { Command } from "commander";
import z from "zod";

export const ValidProviderNames = z.enum(["google", "openai", "anthropic"]);
export type TValidProviderNames = z.infer<typeof ValidProviderNames>;
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
  .option("-a, --api-key <apiKey>", "Your api key", "")
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
    const apiKey = options.apiKey;
    if (!apiKey) {
      console.error("");
      console.error(`Missing API Key for "${parsedProviderName.data}"`);
      console.error("Provide it with an -a or --api-key flag");
      console.error("");
      return;
    }

    const providerFile = Bun.file(PROVIDER_FILE_PATH);
    if (!(await providerFile.exists())) {
      await providerFile.write("{}");
    }
    const data = await providerFile.json();
    const parsed = ProviderContentSchema.safeParse(data);

    if (!parsed.success) {
      console.error(`Invalid provider file @ ${PROVIDER_FILE_PATH}`);
      console.error(parsed.error);
      process.exit(1);
    }
    parsed.data[parsedProviderName.data] = { apiKey };

    await providerFile.write(JSON.stringify(parsed.data));
  });
