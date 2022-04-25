import MiotProperty from './MiotProperty'
import MiotAction from './MiotAction'

type MiotService = {
    iid: number
    type: string
    description: string
    properties: MiotProperty[]
    actions: MiotAction[]
}

export default MiotService
