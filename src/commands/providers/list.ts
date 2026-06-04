import { Command } from "commander";
import { ValidProviderNames } from "./login";

export const listCommand = new Command("list")
  .description("List all the providers supported")
  .action(() => {
    console.log(ValidProviderNames.options);
  });
