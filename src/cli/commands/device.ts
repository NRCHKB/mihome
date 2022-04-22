// noinspection JSUnusedGlobalSymbols

import type { CommandBuilder } from 'yargs'
import { MiIOProtocol, createDevice } from '../../'
import DeviceOptions from '../../types/DeviceOptions'

type Options = {
    name: string
    upper: boolean | undefined
}

export const command: string = 'device [id] [model] [address] [token] [refresh]'
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
            type: 'string',
            describe: 'Refresh timeout',
        })

export const handler = async (argv: DeviceOptions) => {
    new MiIOProtocol().getInstance().init()
    const device = await createDevice(argv)
    device.on('properties', (data) => {
        console.log("on('properties') =>", data)
    })
    device.on('unavailable', (data) => {
        console.error("on('unavailable') =>", data)
    })
    device.on('available', (data) => {
        console.log("on('available') =>", data)
    })
    await device.init()
    //device.destroy()
}
