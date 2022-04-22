import DeviceOptions from './types/DeviceOptions'
import instances from './miot-spec/instances.json'
import MiotDevice from './miot/device-miot'
import { InstancesResponse } from './types/MiotInstance'

const createDevice = ({
    id,
    model,
    token,
    address,
    refresh,
}: DeviceOptions) => {
    const deviceInstance = (instances as InstancesResponse).instances
        .filter((i) => i.model === model)
        .reduce((previous, current) => {
            if (current.version > previous.version) {
                return current
            } else return previous
        })

    if (!deviceInstance) {
        throw new Error(`Model ${model} is not supported`)
    }

    const type = deviceInstance.type

    return new MiotDevice(id, type, address, token, refresh)
}

export { createDevice }
