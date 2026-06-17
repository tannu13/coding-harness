import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type Part,
} from "@google/genai";
import type { ToolRegistry } from "./tools";

export class Agent {
  private ai: GoogleGenAI;
  private history: Content[] = [];
  private model = "gemma-4-26b-a4b-it";

  constructor(apiKey: string, initialPrompt: string, model: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.addUserRole([{ text: initialPrompt }]);
    this.model = model;
  }

  getHistory() {
    return this.history;
  }

  addUserRole(parts: Part[]) {
    this.history.push({
      role: "user",
      parts,
    });
  }

  addModelRole(parts: Part[]) {
    this.history.push({
      role: "model",
      parts,
    });
  }

  async runStep(registry: ToolRegistry, contents: Content[] = this.history) {
    const declarations = registry.getGiminiDeclarations();
    return await this.ai.models.generateContent({
      model: this.model,
      contents,
      config: {
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
            // allowedFunctionNames: ["readFile", "writeFile"],
          },
        },
        tools: [{ functionDeclarations: declarations }],
      },
    });
  }
}
