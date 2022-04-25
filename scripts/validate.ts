import * as fs from 'fs'
import path from 'path'

const validate = require('jsonschema').validate
const MiioDeviceSchema = require('./MiioDeviceSchema.json')

const directory = path.join('src', 'miio-spec', 'devices')
fs.readdir(directory, (e1, filenames) => {
    if (e1) {
        throw e1
    }
    filenames.forEach((name) => {
        if (name.endsWith('.json')) {
            fs.readFile(path.join(directory, name), (e2, data) => {
                if (e2) {
                    throw e2
                }

                const v = validate(
                    JSON.parse(data.toString()),
                    MiioDeviceSchema
                )

                if (!v.valid) {
                    console.error(name, v)
                    throw Error(`Invalid spec for file ${name}`)
                }
            })
        }
    })
})
