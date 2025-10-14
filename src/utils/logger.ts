import pino from "pino";

// Use pino-pretty transport only in development to avoid bundling issues
// In production/bundled mode, use basic pino logger
// Note: Redact feature is disabled to avoid bundling compatibility issues
const isDevelopment = process.env.NODE_ENV === "development";

export const logger = isDevelopment
	? pino({
			level: process.env.LOG_LEVEL || "info",
			transport: {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "HH:MM:ss",
					ignore: "pid,hostname",
				},
			},
		})
	: pino({
			level: process.env.LOG_LEVEL || "info",
		});
