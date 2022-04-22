import * as fs from 'fs'
import { InstancesResponse } from '../src/types/MiotInstance'
import path from 'path'

const fetch = require('node-fetch-retry')
const minify = require('node-json-minify')

;(async () => {
    console.log(`Fetching instances`)
    await fetch('https://miot-spec.org/miot-spec-v2/instances?status=all')
        .then(async (res: any) => await res.json())
        .then((json: any) =>
            fs.writeFileSync(
                'src/miot-spec/instances.json',
                minify(JSON.stringify(json)),
                {
                    encoding: 'utf8',
                    flag: 'w',
                }
            )
        )

    const mergedInstancesCache =
        require('../src/miot-spec/instances.json') as InstancesResponse

    for (const i of mergedInstancesCache.instances) {
        console.log(`Fetching ${i.type}`)
        await fetch(
            `https://miot-spec.org/miot-spec-v2/instance?type=${i.type}`,
            { retry: 100, pause: 1000, silent: true }
        )
            .then(async (res: any) => await res.json())
            .then((json: any) => {
                const specFilePath = path.join(
                    'src',
                    'miot-spec',
                    'devices',
                    `${i.type.replaceAll(':', '.')}.json`
                )

                fs.writeFileSync(specFilePath, minify(JSON.stringify(json)), {
                    encoding: 'utf8',
                    flag: 'w',
                })
            })
    }
})()
