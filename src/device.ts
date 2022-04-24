import DeviceOptions from './types/DeviceOptions'
import instances from './miot-spec/instances.json'
import MiotDevice from './miot/device-miot'
import { InstancesResponse } from './types/MiotInstance'
import path from 'path'
import fs from 'fs'
import fetch from 'node-fetch'
import { logger } from '@nrchkb/logger'

const log = logger('@nrchkb/mihome', 'device')

const createDevice = async (options: DeviceOptions) => {
    log.debug(`Creating device with ${options}`)
    const { id, model, token, address, refresh, chunkSize } = options
    const deviceInstance = (instances as InstancesResponse).instances
        .filter((i) => i.model === model && i.status === 'released')
        .reduce((previous, current) => {
            if (current.version > previous.version) {
                return current
            } else return previous
        })

    if (!deviceInstance) {
        throw new Error(`Model ${model} is not supported`)
    }

    const type = deviceInstance.type

    const specExists = await fetchSpec(type)
    if (!specExists) {
        throw Error(`Failed to fetch spec for ${type}`)
    }

    return new MiotDevice(id, type, address, token, refresh, chunkSize)
}

const fetchSpec = async (type: string) => {
    log.debug(`Checking spec for ${type}`)
    const specName = `${type.replaceAll(':', '.')}.json`

    const specFilePath = path.join(
        __dirname,
        'miot-spec',
        'devices',
        `${specName}`
    )

    const fileExists = fs.existsSync(specFilePath)

    if (!fileExists) {
        log.debug(`Fetching spec for ${type}`)

        const cachedSpec = `https://raw.githubusercontent.com/NRCHKB/mihome/master/src/miot-spec/devices/${specName}`
        const sourceSpec = `https://miot-spec.org/miot-spec-v2/instance?type=${type}`

        log.debug(`Fetching spec for ${type} => cache`)
        await fetch(cachedSpec)
            .then(async (res) => {
                if (res.status === 404) {
                    log.debug(`Fetching spec for ${type} => source`)
                    return await fetch(sourceSpec).then(async (res) => {
                        if (res.status === 404) {
                            throw Error(`${res.status}`)
                        } else {
                            return await res.json()
                        }
                    })
                } else {
                    return await res.json()
                }
            })
            .then((json) => {
                fs.writeFileSync(specFilePath, JSON.stringify(json), {
                    encoding: 'utf8',
                    flag: 'w',
                })
            })
            .catch((error) => {
                log.error(error)
            })
    }

    return fs.existsSync(specFilePath)
}

export { createDevice }
