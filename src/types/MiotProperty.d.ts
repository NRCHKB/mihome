type Access = 'read' | 'notify' | 'write'

type ValueListItem = {
    value: number
    description: string
}

type Property = {
    iid: number
    type: string
    description: string
    format: 'string' | 'uint8' | 'bool' | 'float' | 'uint16'
    access: Access[]
    'value-list'?: ValueListItem[]
    unit?:
        | 'celsius'
        | 'percentage'
        | 'hours'
        | 'pascal'
        | 'ppm'
        | 'mg/m3'
        | 'kelvin'
        | 'rgb'
    'value-range'?: number[]
}

export default Property
