import { Command, program } from "commander";
import { setModelsCommand } from "./set";
import { listCommand } from "./list";

export const modelsCommand = new Command("models")
  .description("Returns all the supported models")
  .addCommand(listCommand)
  .addCommand(setModelsCommand);
