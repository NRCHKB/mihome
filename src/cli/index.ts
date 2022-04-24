#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
const { version } = require('../../package.json')

console.error(`Using @nrchkb/mihome@${version}`)

yargs(hideBin(process.argv))
    .commandDir('commands')
    .strict()
    .alias({ h: 'help' }).argv
