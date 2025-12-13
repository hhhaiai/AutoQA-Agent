import { z } from 'zod'

export const autoqaConfigSchema = z
  .object({
    schemaVersion: z.number().int().min(1),
  })
  .strict()

export type AutoqaConfig = z.infer<typeof autoqaConfigSchema>
