import { z } from "zod";

// Validates Vite env at startup so a missing/typo'd var fails loudly
// instead of surfacing as `undefined` deep inside a request.
const schema = z.object({
  VITE_API_URL: z.string().url().default("http://localhost:3000/api"),
  VITE_SOCKET_URL: z.string().url().default("http://localhost:3000"),   
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;