import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type FunctionDeclaration,
} from "@google/genai";
import env from "./env";
import z from "zod";
const GEMINI_API_KEY = env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const ReadFileSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
});
type TReadFileSchema = z.infer<typeof ReadFileSchema>;

const WriteFileSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
  content: z.string().min(1, "Content cannot be empty"),
});
type TWriteFileSchema = z.infer<typeof WriteFileSchema>;

const readFileDeclaration: FunctionDeclaration = {
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
};

const writeFileDeclaration: FunctionDeclaration = {
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
};

const toolRegistry = {
  readFile: {
    schema: ReadFileSchema,
    execute: async (
      args: TReadFileSchema,
    ): Promise<Record<string, unknown>> => {
      console.log(args.path);
      return {
        file: args.path,
        content:
          'A rainbow is a stunning optical phenomenon that creates a multicolored arc in the sky. It forms when sunlight enters raindrops, undergoing refraction (bending), reflection off the back of the droplet, and refraction again upon exiting. This splits white light into its core wavelengths.The resulting spectrum features seven distinct colors: red, orange, yellow, green, blue, indigo, and violet, famously remembered by the acronym ROYGBIV. To spot one, the sun must be shining behind you at a low angle while rain falls in front of you. Although they appear as semi-circles on the ground, rainbows are actually complete circular rings, a perspective fully visible from an airplane.While the primary bow features red on the outside and violet inside, a secondary, fainter rainbow with reversed colors occasionally forms due to double internal reflection. Because a rainbow is an optical illusion rather than a physical object, you can never reach its "end". Culturally, it is a universal symbol of hope, peace, and good fortune.',
      };
    },
  },
  writeFile: {
    schema: WriteFileSchema,
    execute: async (
      args: TWriteFileSchema,
    ): Promise<Record<string, unknown>> => {
      console.log("Write file called", args.path, args.content);
      return {
        fileWritten: args.path,
        content: args.content,
      };
    },
  },
} as const;
type TToolName = keyof typeof toolRegistry;

async function main() {
  const conversationHistory: Content[] = [
    {
      role: "user",
      parts: [
        {
          text: "Read './rainbow.txt' and write a summary to rainbow-summary.txt in 50 chars.",
        },
      ],
    },
  ];

  let processing = true;
  let maxIterations = 5; // Guardrails to prevent infinite loops
  let iteration = 0;

  while (processing && iteration < maxIterations) {
    iteration++;
    const response = await ai.models.generateContent({
      // Gemma 4 26B
      model: "gemma-4-26b-a4b-it",
      contents: conversationHistory,
      config: {
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
            // allowedFunctionNames: ["readFile", "writeFile"],
          },
        },
        tools: [
          { functionDeclarations: [readFileDeclaration, writeFileDeclaration] },
        ],
      },
    });
    // console.dir(response, { depth: 10 });

    if (response.functionCalls) {
      conversationHistory.push({
        role: "model",
        parts: response.functionCalls.map((call) => ({ functionCall: call })),
      });
      console.log(
        "The LLM requested a tool call:",
        JSON.stringify(response.functionCalls, null, 2),
      );

      const toolResponseParts = [];
      for (const fn of response.functionCalls) {
        const fnName = fn.name as TToolName;

        if (!(fnName in toolRegistry)) {
          console.warn(`LLM requested unknown tool: ${fnName}`);
          continue;
        }

        const tool = toolRegistry[fnName];

        const parseResult = tool.schema.safeParse(fn.args);
        if (!parseResult.success) {
          console.error(
            `Validation failed for tool '${fnName}'. Errors:`,
            parseResult.error.flatten(),
          );
          continue;
        }

        try {
          const result = await tool.execute(parseResult.data as any);
          toolResponseParts.push({
            functionResponse: {
              name: fnName,
              response: result,
            },
          });
        } catch (err) {
          console.error(`Runtime error executing ${fnName}`, err);
        }
      }

      conversationHistory.push({
        role: "user",
        parts: toolResponseParts,
      });
    } else {
      console.log("Final Response: ", response);
      processing = false;
    }
  }
}

main();
