import MiotService from './MiotService'

type MiotDevice = {
    type: string
    description: string
    services: MiotService[]
}

export default MiotDevice
