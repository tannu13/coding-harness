import type { FunctionDeclaration } from "@google/genai";
import z from "zod";

const ReadFileSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
});

const WriteFileSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
  content: z.string().min(1, "Content cannot be empty"),
});

interface AgentTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  declaration: FunctionDeclaration;
  schema: S;
  execute: (args: z.infer<S>) => Promise<Record<string, unknown>>;
}

export const readFileTool: AgentTool<typeof ReadFileSchema> = {
  name: "readFile",
  declaration: {
    name: "readFile",
    description:
      "Reads the content of a file from the local file system given its path.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The relative or absolute path to the file.",
        },
      },
      required: ["path"],
    },
  },
  schema: ReadFileSchema,
  execute: async (args) => {
    console.log(args.path);
    return {
      file: args.path,
      content:
        'A rainbow is a stunning optical phenomenon that creates a multicolored arc in the sky. It forms when sunlight enters raindrops, undergoing refraction (bending), reflection off the back of the droplet, and refraction again upon exiting. This splits white light into its core wavelengths.The resulting spectrum features seven distinct colors: red, orange, yellow, green, blue, indigo, and violet, famously remembered by the acronym ROYGBIV. To spot one, the sun must be shining behind you at a low angle while rain falls in front of you. Although they appear as semi-circles on the ground, rainbows are actually complete circular rings, a perspective fully visible from an airplane.While the primary bow features red on the outside and violet inside, a secondary, fainter rainbow with reversed colors occasionally forms due to double internal reflection. Because a rainbow is an optical illusion rather than a physical object, you can never reach its "end". Culturally, it is a universal symbol of hope, peace, and good fortune.',
    };
  },
};

export const writeFileTool: AgentTool<typeof WriteFileSchema> = {
  name: "writeFile",
  declaration: {
    name: "writeFile",
    description: "Writes or overwrites content to a specified file path.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path where the file should be saved.",
        },
        content: {
          type: "string",
          description: "The text content to write into the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  schema: WriteFileSchema,
  execute: async (args) => {
    console.log("Write file called", args.path, args.content);
    return {
      fileWritten: args.path,
      content: args.content,
    };
  },
};
export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool) {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  getGiminiDeclarations() {
    return Array.from(this.tools.values()).map((t) => t.declaration);
  }
}
