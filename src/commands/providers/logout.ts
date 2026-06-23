import { Command } from "commander";
import { ProviderContentSchema, ValidProviderNames } from "./login";
import env from "../../env";

export const logoutCommand = new Command("logout")
  .description("Lets user logout from the provider")
  .option(
    "-p, --provider <providerName>",
    "Name of the provider (gemini, claude etc)",
    "",
  )
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

    const providerFile = Bun.file(env.PROVIDER_FILE_PATH);
    if (!(await providerFile.exists())) {
      await providerFile.write("{}");
    }

    const data = await providerFile.json();
    const parsed = ProviderContentSchema.safeParse(data);

    if (!parsed.success) {
      console.error(`Invalid provider file @ ${env.PROVIDER_FILE_PATH}`);
      console.error(parsed.error);
      process.exit(1);
    }

    delete parsed.data[parsedProviderName.data];
    await providerFile.write(JSON.stringify(parsed));
  });
