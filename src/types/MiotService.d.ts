import Property from './MiotProperty'

type Service = {
    iid: number
    type: string
    description: string
    properties: Property[]
}

export default Service
