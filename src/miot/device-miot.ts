import EventEmitter from 'events'
import * as fs from 'fs'
import miIOProtocol from './protocol-miot'
import Device from '../types/MiotDevice'
import { logger } from '@nrchkb/logger'
import { Loggers } from '@nrchkb/logger/src/types'
import path from 'path'
import util from 'util'

const sleep = (time: number) => {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve()
        }, time)
    })
}

class MiotDevice extends EventEmitter {
    private properties: {
        [key: string]: string
    }
    private propertiesToMonitor: {
        [key: string]: { siid: number; piid: number; desc: string }
    }
    private refreshInterval: NodeJS.Timer | undefined
    private log: Loggers

    constructor(
        private id: string,
        private type: string,
        private address: string,
        token: string,
        private refresh: number = 15000
    ) {
        super()

        this.log = logger('@nrchkb/mihome', 'MiotDevice', this.id)

        this.propertiesToMonitor = {}
        this.properties = {}

        miIOProtocol.getInstance().updateDevice(address, {
            id,
            token,
        })
    }

    async init(): Promise<any> {
        //`../miot-spec/devices/${this.type}.json`
        const specFilePath = path.join(
            __dirname,
            '..',
            'miot-spec',
            'devices',
            `${this.type.replaceAll(':', '.')}.json`
        )
        this.log.debug(`Reading spec from ${specFilePath}`)
        const data = await fs.readFileSync(specFilePath)
        const deviceData = JSON.parse(data.toString()) as Device

        this.log.debug(
            `Loaded spec for ${deviceData.description} ${deviceData.type}`
        )

        deviceData.services.forEach((service) => {
            service.properties.forEach((property) => {
                const key = [
                    service.type.split(':')[3],
                    property.type.split(':')[3],
                ].join(':')
                this.log.debug(`Registered ${key}`)
                this.propertiesToMonitor[key] = {
                    siid: service.iid,
                    piid: property.iid,
                    desc: `${service.description} - ${property.description}`,
                }
            })
        })

        await this.loadProperties()
        await this.poll()

        return Promise.resolve(this.properties)
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
        }
    }

    async send<T>(method: string, params: any[], options = {}) {
        return await miIOProtocol
            .getInstance()
            .send<T>(this.address, method, params, options)
    }

    async poll() {
        if (this.refresh > 0) {
            this.refreshInterval = setInterval(async () => {
                await this.loadProperties()
            }, this.refresh)
        }
    }

    async loadProperties(props?: string[]) {
        try {
            if (typeof props === 'undefined') {
                props = Object.keys(this.propertiesToMonitor)
            }
            const data: { [key: string]: string } = {}
            const propsChunks = []
            // Add it as configurable param as it can speed up fetching but cause errors like 16 for purifier 3h
            const chunkSize = 15
            for (let i = 0; i < props.length; i += chunkSize) {
                propsChunks.push(props.slice(i, i + chunkSize))
            }

            let result: any[] = []
            for (const propChunk of propsChunks) {
                const resultChunk = await this.getProperties(propChunk)
                if (!resultChunk) {
                    throw Error('Properties is empty')
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

            this.properties = Object.assign(this.properties, data)
            this.emit('available', true)
            this.emit('properties', data)
        } catch (e: any) {
            this.emit('unavailable', e?.message)
        }
    }

    async getProperties(props: string[]) {
        const did = this.id
        const params = props.map((prop) => {
            const { siid, piid } = this.propertiesToMonitor[prop]
            return { did, siid, piid }
        })

        const result = await this.send<{ code: number; value: any }[] | string>(
            'get_properties',
            params
        )

        if (!Array.isArray(result)) {
            if (result === 'unknown_method') {
                this.log.error(
                    `Error unknown_method for ${util.inspect(params)}`
                )
                return undefined
            } else {
                this.log.error(`Error ${result} for ${util.inspect(params)}`)
                return undefined
            }
        }

        return result.map(({ code, value }) => {
            if (code === 0) {
                return value
            }
            this.log.debug(`getProperties(props) code:${code} value:${value}`)
            return undefined
        })
    }

    async miotSetProperty(
        prop: string,
        value: any,
        options: { refresh?: boolean } = {}
    ) {
        const def = this.propertiesToMonitor[prop]
        if (!def) {
            throw new Error(`Property ${prop} is not define`)
        }
        const { siid, piid } = def
        const did = this.id
        const result = await this.send<{ code: number }[]>('set_properties', [
            {
                did,
                siid,
                piid,
                value,
            },
        ])

        if (!result || !result[0] || result[0].code !== 0) {
            throw new Error('Could not perform operation')
        }

        if (options.refresh !== false) {
            await sleep(50)
            await this.loadProperties([prop])
        }

        return result[0]
    }
}

export default MiotDevice
