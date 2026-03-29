import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  musicLibraryPath: z.string().min(1),
  dbPath: z.string().min(1),
  mbAppName: z.string().default('cratedigger'),
  mbAppVersion: z.string().default('1.0.0'),
  mbContactEmail: z.string().email(),
  scanOnStartup: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

export const config = configSchema.parse({
  musicLibraryPath: process.env.MUSIC_LIBRARY_PATH,
  dbPath: process.env.DB_PATH,
  mbAppName: process.env.MB_APP_NAME,
  mbAppVersion: process.env.MB_APP_VERSION,
  mbContactEmail: process.env.MB_CONTACT_EMAIL,
  scanOnStartup: process.env.SCAN_ON_STARTUP,
  logLevel: process.env.LOG_LEVEL,
});
