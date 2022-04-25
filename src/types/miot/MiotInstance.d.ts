import InstanceStatus from '../InstanceStatus'

type MiotInstance = {
    status: InstanceStatus
    model: string
    version: number
    type: string
}

type MiotInstancesResponse = { instances: MiotInstance[] }

export default MiotInstance

export { MiotInstancesResponse, MiotInstance }
