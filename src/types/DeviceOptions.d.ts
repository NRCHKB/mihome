import Protocol from './Protocol'

type DeviceOptions = {
    id: string
    model: string
    refresh?: number
    address: string
    token: string
    chunkSize?: number
    protocol?: Protocol
}

export default DeviceOptions
