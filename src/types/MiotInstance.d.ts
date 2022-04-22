type InstanceStatus = 'released' | 'debug'

type Instance = {
    status: InstanceStatus
    model: string
    version: number
    type: string
}

type InstancesResponse = { instances: Instance[] }

export default Instance

export { InstancesResponse, InstanceStatus, Instance }
