import * as fs from 'fs'
import path from 'path'

import MiotDevice from '../src/types/miot/MiotDevice'
import { MiotInstancesResponse } from '../src/types/miot/MiotInstance'

const fetch = require('node-fetch-retry')
const minify = require('node-json-minify')

;(async () => {
    await fetch('https://miot-spec.org/miot-spec-v2/instances?status=all')
        .then(
            async (res: { json: () => MiotInstancesResponse }) =>
                await res.json()
        )
        .then((json: MiotInstancesResponse) =>
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
        require('../src/miot-spec/instances.json') as MiotInstancesResponse

    for (const i of mergedInstancesCache.instances) {
        await fetch(
            `https://miot-spec.org/miot-spec-v2/instance?type=${i.type}`,
            { retry: 100, pause: 1000, silent: true }
        )
            .then(async (res: { json: () => MiotDevice }) => await res.json())
            .then((json: MiotDevice) => {
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
