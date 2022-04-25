import Unit from '../Unit'
import DataFormat from '../DataFormat'
import AccessMode from '../AccessMode'
import ValueListItem from '../ValueListItem'

type MiioProperty = {
    type: string
    description: string
    format: DataFormat
    access: AccessMode[]
    'value-list'?: ValueListItem[]
    unit?: Unit
    'value-range'?: [min: number, max: number, step: number]
    'max-length'?: number
}

export default MiioProperty
