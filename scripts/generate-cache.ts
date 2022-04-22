import fetch from 'node-fetch'
import * as fs from 'fs'
import { InstancesResponse } from '../src/types/MiotInstance'
import path from 'path'
const minify = require('node-json-minify')

const sleep = (milliseconds: number) => {
    const date = Date.now()
    let currentDate = null
    do {
        currentDate = Date.now()
    } while (currentDate - date < milliseconds)
}

;(async () => {
    console.log(`Fetching instances`)
    await fetch('https://miot-spec.org/miot-spec-v2/instances?status=all')
        .then(async (res) => await res.json())
        .then((json) =>
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
            `https://miot-spec.org/miot-spec-v2/instance?type=${i.type}`
        )
            .then(async (res) => await res.json())
            .then((json) => {
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
        sleep(30)
    }
})()
