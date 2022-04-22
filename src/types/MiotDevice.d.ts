import Service from './MiotService'

type Device = {
    type: string
    description: string
    services: Service[]
}

export default Device
