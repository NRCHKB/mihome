import MiioAction from './MiioAction'
import MiioProperty from './MiioProperty'

type MiioDevice = {
    type: string
    description: string
    properties: MiioProperty[]
    actions: MiioAction[]
}

export default MiioDevice
