import { getEnv } from "../utils/get-env";

const appConfig = () => ({
  NODE_ENV: getEnv("NODE_ENV", "development"),
  PORT: Number(process.env.PORT) || 3000,
  BASE_PATH: getEnv("BASE_PATH", "/"),

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_ACCESS_SECRET: getEnv("JWT_ACCESS_SECRET", "super_access_secret"),

  JWT_REFRESH_SECRET: getEnv("JWT_REFRESH_SECRET", "super_refresh_secret"),

  JWT_ACCESS_EXPIRES_IN: getEnv("JWT_ACCESS_EXPIRES_IN", "15m"),

  JWT_REFRESH_EXPIRES_IN: getEnv("JWT_REFRESH_EXPIRES_IN", "7d"),

  SESSION_SECRET: getEnv("SESSION_SECRET", "secret"),
  SESSION_EXPIRES_IN: getEnv("SESSION_EXPIRES_IN", "1d"),

  REFRESH_SECRET: getEnv("REFRESH_SECRET", "refresh_secret"),

  FRONTEND_ORIGIN: getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
});

export const config = appConfig();
