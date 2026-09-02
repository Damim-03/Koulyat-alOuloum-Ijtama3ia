import { defineConfig } from "prisma/config";
import "dotenv/config";
import {config} from "./src/core/config/app.config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: config.DATABASE_URL,
  },
});