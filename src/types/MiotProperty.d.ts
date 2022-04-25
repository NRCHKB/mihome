type AccessMode = 'read' | 'notify' | 'write'

type ValueType = number | boolean | string

type ValueListItem = {
    value: number
    description: string
}

type DataFormat =
    | 'bool'
    | 'uint8'
    | 'uint16'
    | 'uint32'
    | 'int8'
    | 'int16'
    | 'int32'
    | 'int64'
    | 'float'
    | 'string'
    | 'hex'

type Unit =
    | 'percentage'
    | 'celsius'
    | 'seconds'
    | 'minutes'
    | 'hours'
    | 'days'
    | 'kelvin'
    | 'pascal'
    | 'arcdegrees'
    | 'rgb'
    | 'watt'
    | 'litre'
    | 'ppm'
    | 'lux'
    | 'mg/m3'
    | 'none'

type Property = {
    iid: number
    type: string
    description: string
    format: DataFormat
    access: AccessMode[]
    'value-list'?: ValueListItem[]
    unit?: Unit
    'value-range'?: [min: number, max: number, step: number]
    'max-length'?: number
}

export default Property

export { AccessMode, ValueType, Unit, ValueListItem, Property, DataFormat }
