import z from "zod";

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  MODEL_FILE_PATH: z.string().min(1),
  PROVIDER_FILE_PATH: z.string().min(1),
});

type Env = z.infer<typeof EnvSchema>;
let env: Env;
try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Invalid environment variables", error);
    console.error(JSON.stringify(z.treeifyError(error), null, 2));

    error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      console.error(`  ${path}: ${issue.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export default env;
export { env };
