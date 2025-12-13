import { Command } from 'commander'

import { registerInitCommand } from './commands/init.js'

export function createProgram() {
  const program = new Command()

  program.name('autoqa').description('AutoQA Agent CLI')

  registerInitCommand(program)

  return program
}
