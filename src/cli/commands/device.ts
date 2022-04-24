// noinspection JSUnusedGlobalSymbols

import type { CommandBuilder } from 'yargs'
import { MiIOProtocol, createDevice } from '../../'
import DeviceOptions from '../../types/DeviceOptions'

type Options = {
    name: string
    upper: boolean | undefined
}

export const command: string =
    'device [id] [model] [address] [token] [refresh] [chunkSize]'
export const desc: string = 'Connect to device and list it.'

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
            type: 'number',
            describe: 'Refresh timeout',
            default: 15000,
        })
        .positional('chunkSize', {
            type: 'number',
            describe: 'Chunk size',
            default: 15,
        })

export const handler = async (argv: DeviceOptions) => {
    new MiIOProtocol().getInstance().init()
    const device = await createDevice(argv)

    function exitHandler(
        options: { cleanup?: boolean; exit?: boolean },
        exitCode?: any
    ) {
        device.destroy()
        if (options.cleanup) console.log('clean')
        if (exitCode || exitCode === 0) console.log(exitCode)
        if (options.exit) process.exit()
    }

    process.on('exit', exitHandler.bind(null, { cleanup: true }))
    process.on('SIGINT', exitHandler.bind(null, { exit: true }))
    process.on('SIGUSR1', exitHandler.bind(null, { exit: true }))
    process.on('SIGUSR2', exitHandler.bind(null, { exit: true }))
    process.on('uncaughtException', exitHandler.bind(null, { exit: true }))

    device.on('change', (data) => {
        console.log("on('change') =>", data)
    })
    device.on('unavailable', (data) => {
        console.error("on('unavailable') =>", data)
    })
    device.on('available', (data) => {
        console.log("on('available') =>", data)
    })
    await device.init().then((data) => {
        console.log('init() =>', data)
    })
}
