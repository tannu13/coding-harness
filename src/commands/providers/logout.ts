import fs from "node:fs";
import { Command } from "commander";
import {
  PROVIDER_FILE_PATH,
  ProviderContentSchema,
  ValidProviderNames,
} from "./login";

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

      delete parsed.data[parsedProviderName.data];

      const res = await fs.writeFile(
        PROVIDER_FILE_PATH,
        JSON.stringify(parsed.data),
        (err) => {
          console.error(err);
        },
      );
    });
  });
