// noinspection JSUnusedGlobalSymbols

import type { CommandBuilder } from 'yargs'
import { MiIOProtocol } from '../../miot/protocol-miot'
import { createDevice } from '../../device'
import DeviceOptions from '../../types/DeviceOptions'
import * as util from 'util'
import { logger } from '@nrchkb/logger'

type Options = {
    name: string
    upper: boolean | undefined
}

export const command: string = 'device [id] [model] [address] [token] [refresh]'
export const desc: string = 'Connect to device and list it.'

const log = logger('@nrchkb/mihome', 'cli')

export const builder: CommandBuilder<Options, Options> = (yargs) =>
    yargs
        .positional('id', {
            type: 'string',
            describe: 'Device ID',
        })
        .positional('model', {
            type: 'string',
            describe: 'Device model',
        })
        .positional('address', {
            type: 'string',
            describe: 'Device address (ip)',
        })
        .positional('token', {
            type: 'string',
            describe: 'Device token',
        })
        .positional('refresh', {
            type: 'string',
            describe: 'Refresh timeout',
        })

export const handler = async (argv: DeviceOptions) => {
    new MiIOProtocol().getInstance().init()
    const device = await createDevice(argv)
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