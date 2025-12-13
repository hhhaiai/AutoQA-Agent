import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { defaultAutoqaConfig } from './defaults.js'
import { autoqaConfigSchema } from './schema.js'

export const AUTOQA_CONFIG_FILE_NAME = 'autoqa.config.json'

export class AutoqaConfigAlreadyExistsError extends Error {
  constructor(public readonly configPath: string) {
    super(`Config file already exists: ${configPath}`)
    this.name = 'AutoqaConfigAlreadyExistsError'
  }
}

export function writeDefaultConfigFile(cwd: string = process.cwd()): string {
  const config = autoqaConfigSchema.parse(defaultAutoqaConfig)
  const configPath = join(cwd, AUTOQA_CONFIG_FILE_NAME)
  const contents = `${JSON.stringify(config, null, 2)}\n`

  try {
    writeFileSync(configPath, contents, { encoding: 'utf8', flag: 'wx' })
  } catch (err: any) {
    if (err?.code === 'EEXIST') {
      throw new AutoqaConfigAlreadyExistsError(configPath)
    }

    throw err
  }

  return configPath
}
