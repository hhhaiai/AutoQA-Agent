import { Command } from 'commander'

import {
  AutoqaConfigAlreadyExistsError,
  AUTOQA_CONFIG_FILE_NAME,
  writeDefaultConfigFile,
} from '../../config/init.js'

function isUserCorrectableFsError(err: any): boolean {
  const code = err?.code
  if (typeof code !== 'string') return false
  return ['EACCES', 'EPERM', 'EROFS', 'ENOTDIR', 'EISDIR', 'ENOENT'].includes(code)
}

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description(`Generate default ${AUTOQA_CONFIG_FILE_NAME} in current directory`)
    .action(() => {
      try {
        writeDefaultConfigFile(process.cwd())
        console.log(`Created ${AUTOQA_CONFIG_FILE_NAME}`)
      } catch (err: any) {
        if (err instanceof AutoqaConfigAlreadyExistsError) {
          program.error(
            `${AUTOQA_CONFIG_FILE_NAME} already exists. Refusing to overwrite.`,
            { exitCode: 2 },
          )
          return
        }

        if (isUserCorrectableFsError(err)) {
          program.error(
            `Failed to create ${AUTOQA_CONFIG_FILE_NAME}: ${err?.message ?? String(err)}`,
            { exitCode: 2 },
          )
          return
        }

        program.error(
          `Failed to create ${AUTOQA_CONFIG_FILE_NAME}: ${err?.message ?? String(err)}`,
        )
        return
      }
    })
}
