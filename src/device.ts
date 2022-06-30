import DeviceOptions from './types/DeviceOptions'
import miotInstances from './miot-spec/instances.json'
import miioInstances from './miio-spec/instances.json'
import MiotDevice from './device-miot'
import MiioDevice from './device-miio'
import { MiotInstance, MiotInstancesResponse } from './types/miot/MiotInstance'
import path from 'path'
import fs from 'fs'
import fetch from 'node-fetch'
import { logger } from '@nrchkb/logger'
import util from 'util'
import MiioInstance from './types/miio/MiioInstance'
import Protocol from './types/Protocol'

const log = logger('@nrchkb/mihome', 'device')

const createDevice = async (options: DeviceOptions) => {
    log.debug(`Creating device with ${util.inspect(options)}`)
    const { id, model, token, address, refresh, chunkSize, protocol } = options

    const { miio, miot } = checkForSpec(model)

    if (!miio && !miot) {
        throw new Error(`Model ${model} is not supported`)
    }

    const derivedProtocol: Protocol | undefined =
        protocol ?? (miio ? 'miio' : miot ? 'miot' : undefined)

    if (derivedProtocol === 'miio' && miio) {
        const specExists = await fetchMiioSpec(`${miio.model}:${miio.version}`)
        if (!specExists) {
            throw Error(
                `Failed to fetch spec for ${miio.model}:${miio.version}`
            )
        }
        log.debug(`Using MIIO for ${miio.model}:${miio.version}`)
        return new MiioDevice(
            id,
            `${miio.model}:${miio.version}`,
            address,
            token,
            refresh,
            chunkSize
        )
    }

    if (derivedProtocol === 'miot' && miot) {
        const specExists = await fetchMiotSpec(miot.type)
        if (!specExists) {
            throw Error(`Failed to fetch spec for ${miot}`)
        }
        log.debug(`Using MIOT for ${miot.model}:${miot.version}`)
        return new MiotDevice(id, miot.type, address, token, refresh, chunkSize)
    }

    throw Error(`Failed to find protocol for ${model}`)
}

const checkForSpec = (
    model: string
): { miio?: MiioInstance; miot?: MiotInstance } => {
    const miotReleasedInstances = (
        miotInstances as MiotInstancesResponse
    ).instances?.filter((i) => i.model === model && i.status === 'released')
    const miot = miotReleasedInstances.length
        ? miotReleasedInstances.reduce((previous, current) => {
              if (current.version > previous.version) {
                  return current
              } else return previous
          })
        : undefined

    const miioReleasedInstances = (miioInstances as MiioInstance[])?.filter(
        (i) => i.model === model && i.status === 'released'
    )

    const miio = miioReleasedInstances.length
        ? miioReleasedInstances.reduce((previous, current) => {
              if (current.version > previous.version) {
                  return current
              } else return previous
          })
        : undefined

    const result = {
        miot,
        miio,
    }
    log.debug(`Found specs ${util.inspect(result)}`)

    return result
}

const fetchMiotSpec = async (type: string) => {
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

const fetchMiioSpec = async (model: string) => {
    log.debug(`Checking spec for ${model}`)
    const specName = `${model.replaceAll(':', '.')}.json`

    const specFilePath = path.join(
        __dirname,
        'miio-spec',
        'devices',
        `${specName}`
    )

    const fileExists = fs.existsSync(specFilePath)

    if (!fileExists) {
        log.debug(`Fetching spec for ${model}`)

        const cachedSpec = `https://raw.githubusercontent.com/NRCHKB/mihome/master/src/miio-spec/devices/${specName}`

        log.debug(`Fetching spec for ${model} => cache`)
        await fetch(cachedSpec)
            .then(async (res) => await res.json())
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
