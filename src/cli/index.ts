#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { loggerSetup } from '@nrchkb/logger/src'

loggerSetup({
    errorEnabled: true,
})

yargs(hideBin(process.argv))
    .commandDir('commands')
    .strict()
    .alias({ h: 'help' }).argv
