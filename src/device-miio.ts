import EventEmitter from 'events'
import * as fs from 'fs'
import MiProtocol from './protocol-mi'
import { logger } from '@nrchkb/logger'
import { Loggers } from '@nrchkb/logger/src/types'
import path from 'path'
import ValueType from './types/ValueType'
import MiioDevice from './types/miio/MiioDevice'
import MiioProperty from './types/miio/MiioProperty'

const sleep = (time: number) => {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve()
        }, time)
    })
}

type PropertiesMap = {
    [key: string]: ValueType
}

export default class extends EventEmitter {
    private properties: PropertiesMap
    private propertiesToMonitor: {
        [key: string]: MiioProperty
    }
    private refreshInterval: NodeJS.Timer | undefined
    private log: Loggers

    constructor(
        private id: string,
        private model: string,
        private address: string,
        token: string,
        private refresh: number = 15000,
        private chunkSize: number = 15
    ) {
        super()

        this.log = logger('@nrchkb/mihome', 'MiioDevice', this.id)

        this.propertiesToMonitor = {}
        this.properties = {}

        MiProtocol.getInstance().updateDevice(address, {
            id,
            token,
        })
    }

    async init(): Promise<any> {
        const specFilePath = path.join(
            __dirname,
            'miio-spec',
            'devices',
            `${this.model.replaceAll(':', '.')}.json`
        )
        this.log.debug(`Reading spec from ${specFilePath}`)
        const data = await fs.readFileSync(specFilePath)
        const deviceData = JSON.parse(data.toString()) as MiioDevice

        this.log.debug(
            `Loaded spec for ${deviceData.description} ${deviceData.type}`
        )

        deviceData.properties.forEach((property) => {
            const key = property.type
            this.log.debug(`Registered ${key}`)
            this.propertiesToMonitor[key] = property
        })

        await this.loadProperties(undefined, { init: true })
        await this.poll()

        return Promise.resolve(this.properties)
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
        }
    }

    async send<T>(
        method: string,
        params: any[],
        options: { retries?: number; sid?: number; suppress?: boolean } = {}
    ) {
        return await MiProtocol.getInstance().send<T>(
            this.address,
            method,
            params,
            options
        )
    }

    async poll() {
        if (this.refresh > 0) {
            this.refreshInterval = setInterval(async () => {
                await this.loadProperties()
            }, this.refresh)
        }
    }

    async loadProperties(
        props?: string[],
        options: { chunkSize?: number; init?: boolean } = {}
    ) {
        try {
            if (typeof props === 'undefined') {
                props = Object.keys(this.propertiesToMonitor)
            }

            props = props.filter((p) =>
                this.propertiesToMonitor[p].access.includes('read')
            )

            const data: { [key: string]: string } = {}
            const propsChunks = []
            const chunkSize = options.chunkSize ?? this.chunkSize
            for (let i = 0; i < props.length; i += chunkSize) {
                propsChunks.push(props.slice(i, i + chunkSize))
            }

            let result: any[] = []
            for (const propChunk of propsChunks) {
                const resultChunk = await this.getProperties(propChunk)

                if (!resultChunk) {
                    throw Error('Properties are empty')
                }

                if (resultChunk.length !== propChunk.length) {
                    throw Error(
                        `Result ${JSON.stringify(
                            resultChunk
                        )} and props ${JSON.stringify(
                            propChunk
                        )} does not match length`
                    )
                }
                result = result.concat(resultChunk)
            }

            props.forEach((prop, i) => {
                data[prop] = result[i]
            })

            const getDifference = (
                oldData: PropertiesMap,
                newData: PropertiesMap
            ) =>
                Object.fromEntries(
                    Object.entries(newData)
                        .filter(([key, value]) => oldData[key] !== value)
                        .map(([key, value]) => [
                            key,
                            {
                                previous: this.properties[key],
                                current: value,
                                unit: this.propertiesToMonitor[key].unit,
                            },
                        ])
                )
            const diff = getDifference(this.properties, data)

            if (Object.keys(diff).length > 0) {
                this.emit('properties', data)

                if (!options.init) {
                    this.emit('change', diff)
                    Object.entries(diff).forEach(([key]) => {
                        this.emit(`change:${key}`, diff[key])
                    })
                }

                this.properties = data
            }

            this.emit('available', true)
        } catch (e: any) {
            this.emit('unavailable', e?.message)
        }
    }

    async getProperties(props: string[]) {
        return await this.send<any[]>('get_prop', props, {
            retries: 10,
        })
    }

    async getProperty(prop: string) {
        return this.getProperties([prop])
    }

    async setProperty(
        method: string,
        params: ValueType[],
        options: {
            refresh?: boolean
            retries?: number
            sid?: number
            suppress?: boolean
        } = {}
    ) {
        const result = await this.send<any[]>(method, params, options)

        if (options.refresh) {
            await sleep(50)
            await this.loadProperties()
        }

        return result
    }
}
