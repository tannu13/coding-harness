import { Command, program } from "commander";
import { loginCommand } from "./login";
import { logoutCommand } from "./logout";
import { listCommand } from "./list";

export const providerCommand = new Command("providers")
  .description("Provider related information")
  .addCommand(listCommand)
  .addCommand(loginCommand)
  .addCommand(logoutCommand);
