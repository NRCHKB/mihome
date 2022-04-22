import yargs from 'yargs'
import { createDevice } from './index'
import DeviceOptions from './types/DeviceOptions'
import { loggerSetup } from '@nrchkb/logger/src'
import { logger } from '@nrchkb/logger'
import * as util from 'util'
import miIOProtocol from './miot/protocol-miot'

loggerSetup({
    debugEnabled: true,
    errorEnabled: true,
    traceEnabled: true,
})

const log = logger('@nrchkb/mihome', 'cli')

yargs
    .scriptName('@nrchkb/mihome')
    .usage('$0 <cmd> [args]')
    .command(
        'device [id] [model] [address] [token] [refresh]',
        'Connect to device and list it.',
        (yargs) => {
            yargs.positional('id', {
                type: 'string',
                describe: 'Device ID',
            })
            yargs.positional('model', {
                type: 'string',
                describe: 'Device model',
            })
            yargs.positional('address', {
                type: 'string',
                describe: 'Device address (ip)',
            })
            yargs.positional('token', {
                type: 'string',
                describe: 'Device token',
            })
            yargs.positional('refresh', {
                type: 'string',
                describe: 'Refresh timeout',
            })
        },
        async function (argv) {
            new miIOProtocol().getInstance().init()
            const device = createDevice(argv as unknown as DeviceOptions)
            device.on('properties', (data) => {
                log.debug("on('properties')")
                log.debug(util.inspect(data))
            })
            device.on('unavailable', (data) => {
                log.error("on('unavailable')")
                log.error(util.inspect(data))
            })
            device.on('available', (data) => {
                log.debug("on('available')")
                log.debug(util.inspect(data))
            })
            await device.init().then(() => {
                log.debug('init()')
            })
            //device.destroy()
        }
    )
    .help().argv
