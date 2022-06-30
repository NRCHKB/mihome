import EventEmitter from 'events'
import * as dgram from 'dgram'
import crypto from 'crypto'
import { Socket } from 'dgram'
import { Loggers } from '@nrchkb/logger/src/types'
import { logger } from '@nrchkb/logger'

const PORT = 54321

class MiProtocol extends EventEmitter {
    protected _devices: Map<string, any>
    protected timeout: number
    protected retries: number
    protected _socket: Socket | undefined
    protected _serverStampTime: number
    private log: Loggers

    constructor() {
        super()
        this.log = logger('@nrchkb/mihome', 'MiProtocol')

        this.log.error('Initialized')

        this._devices = new Map()

        this.timeout = 2000
        this._serverStampTime = 0
        this.retries = 2
    }

    init() {
        this.createSocket()
    }

    destroy() {
        this.destroySocket()
    }

    createSocket() {
        this.log.debug('createSocket()')
        this._socket = dgram.createSocket('udp4')

        // Bind the socket and when it is ready mark it for broadcasting
        // this._socket.bind();
        this._socket.on('listening', () => {
            // this._socket.setBroadcast(true);

            const address = this._socket!.address()
            this.log.debug(
                `Server listening ${address.address}:${address.port}`
            )
        })

        // On any incoming message, parse it, update the discovery
        this._socket.on('message', (msg, rinfo) => {
            this._onMessage(rinfo.address, msg)
        })

        this._socket.on('error', (error: any) => {
            this.log.error('Socket error')
            this.log.error(error)
        })
    }

    destroySocket() {
        if (this._socket) {
            this._socket.close()
        }
    }

    getDevices() {
        return Array.from(this._devices.keys()).map((address) => {
            return {
                address,
                ...this.getDevice(address),
            }
        })
    }

    hasDevice(address: string) {
        return this._devices.has(address)
    }

    getDevice(address: string) {
        if (!this._devices.has(address)) {
            this._devices.set(address, {})
        }
        const device = this._devices.get(address)
        if (!device._lastId) {
            device._lastId = 0
        }
        if (!device._promises) {
            device._promises = new Map()
        }
        return device
    }

    setDevice(address: string, data: any) {
        const device = { ...data }
        if (device.token) {
            device._token = Buffer.from(device.token, 'hex')
            device._tokenKey = crypto
                .createHash('md5')
                .update(device._token)
                .digest()
            device._tokenIV = crypto
                .createHash('md5')
                .update(device._tokenKey)
                .update(device._token)
                .digest()
        }
        this._devices.set(address, device)
    }

    updateDevice(address: string, data: { id: string; token: string }) {
        const device = Object.assign(this.getDevice(address), data)
        this.setDevice(address, device)
    }

    _onMessage(address: string, msg: any) {
        try {
            const data = this._decryptMessage(address, msg)

            if (data === null) {
                // hanshake
                this.log.trace(`${address} -> Handshake reply`)
                this._onHandshake(address)
            } else {
                this.log.debug(`${address} -> Data`)
                this._onData(address, data)
            }
        } catch (e: any) {
            this.log.error(`${address} -> Unable to parse packet`)
            this.log.error(e)
        }
    }

    _decryptMessage(address: string, msg: any) {
        const device = this.getDevice(address)

        const deviceId = msg.readUInt32BE(8)
        const stamp = msg.readUInt32BE(12)
        const checksum = msg.slice(16)
        const encrypted = msg.slice(32)

        if (deviceId !== device.id) {
            device.id = deviceId
        }

        if (stamp > 0) {
            device._serverStamp = stamp
            device._serverStampTime = Date.now()
        }

        if (encrypted.length === 0) {
            // hanshake
            if (!checksum.toString('hex').match(/^[fF0]+$/)) {
                // const token = checksum;
            }

            return null
        }

        if (!device._token) {
            throw new Error(`Missing token of device ${deviceId} - ${address}`)
        }

        const digest = crypto
            .createHash('md5')
            .update(msg.slice(0, 16))
            .update(device._token)
            .update(encrypted)
            .digest()

        if (!checksum.equals(digest)) {
            throw new Error(
                `Invalid packet, checksum was ${checksum} should be ${digest}`
            )
        }

        const decipher = crypto.createDecipheriv(
            'aes-128-cbc',
            device._tokenKey,
            device._tokenIV
        )
        const data = Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ])

        return data
    }

    _encryptMessage(address: string, data: any) {
        const device = this.getDevice(address)

        if (!device._token || !device.id) {
            throw new Error(
                `${address} <- Missing token or device.id for send command`
            )
        }

        const header = Buffer.alloc(2 + 2 + 4 + 4 + 4 + 16)
        header[0] = 0x21
        header[1] = 0x31
        for (let i = 4; i < 32; i++) {
            header[i] = 0xff
        }
        for (let i = 4; i < 8; i++) {
            header[i] = 0x00
        }

        // Update the stamp to match server
        const secondsPassed = Math.floor(
            (Date.now() - device._serverStampTime) / 1000
        )
        header.writeUInt32BE(device._serverStamp + secondsPassed, 12)

        // Encrypt the data
        const cipher = crypto.createCipheriv(
            'aes-128-cbc',
            device._tokenKey,
            device._tokenIV
        )
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()])

        // Set the length
        header.writeUInt16BE(32 + encrypted.length, 2)

        // Calculate the checksum md5
        const digest = crypto
            .createHash('md5')
            .update(header.slice(0, 16))
            .update(device._token)
            .update(encrypted)
            .digest()

        // Device ID
        header.writeUInt32BE(Number(device.id), 8)

        digest.copy(header, 16)

        return Buffer.concat([header, encrypted])
    }

    _onHandshake(address: string) {
        const device = this.getDevice(address)
        if (device._handshakeResolve) {
            device._handshakeResolve()
        }
    }

    _onData(address: string, msg: any) {
        // Handle null-terminated strings
        if (msg[msg.length - 1] === 0) {
            msg = msg.slice(0, msg.length - 1)
        }

        // Parse and handle the JSON message
        let str = msg.toString('utf8')

        // Remove non-printable characters to help with invalid JSON from devices
        str = str.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '') // eslint-disable-line

        this.log.debug(`${address} -> Message: ${str}`)
        try {
            const data = JSON.parse(str)
            const device = this.getDevice(address)
            const p = device._promises.get(data.id)
            if (!p) return
            if (typeof data.result !== 'undefined') {
                p.resolve(data.result)
            } else {
                p.reject(data.error)
            }
        } catch (ex: any) {
            this.log.error(`${address} -> Invalid JSON`)
            this.log.error(ex)
        }
    }

    _socketSend(msg: any, address: string, port = PORT) {
        return new Promise<void>((resolve, reject) => {
            this._socket?.send(msg, 0, msg.length, port, address, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }

    _handshake(address: string) {
        const msg = Buffer.from(
            '21310020ffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            'hex'
        )
        return this._socketSend(msg, address)
    }

    _send(address: string, request: Record<any, any>) {
        const msg = this._encryptMessage(
            address,
            Buffer.from(JSON.stringify(request), 'utf8')
        )
        return this._socketSend(msg, address)
    }

    async handshake(address: string) {
        if (!address) {
            throw new Error('Missing address for handshake')
        }

        const device = this.getDevice(address)

        const needsHandshake =
            !device.serverStampTime ||
            Date.now() - this._serverStampTime! > 120000
        if (!needsHandshake) {
            return Promise.resolve()
        }

        // If a handshake is already in progress use it
        if (device._handshakePromise) {
            return device._handshakePromise
        }

        device._handshakePromise = new Promise<void>((resolve, reject) => {
            this._handshake(address).catch(reject)

            device._handshakeResolve = () => {
                clearTimeout(device._handshakeTimeout)
                device._handshakeResolve = null
                device._handshakeTimeout = null
                device._handshakePromise = null

                resolve()
            }

            // Timeout for the handshake
            device._handshakeTimeout = setTimeout(() => {
                device._handshakeResolve = null
                device._handshakeTimeout = null
                device._handshakePromise = null

                const err: any = new Error(
                    'Could not connect to device, handshake timeout'
                )
                err.code = 'timeout'
                reject(err)
            }, this.timeout)
        })

        return device._handshakePromise
    }

    async send<T = any>(
        address: string,
        method: string,
        params: any[] = [],
        options: { retries?: number; sid?: number; suppress?: boolean } = {}
    ) {
        this.log.trace(
            `Call ${address}: ${method} - ${JSON.stringify(
                params
            )} - ${JSON.stringify(options)}`
        )
        const request: any = {
            method,
            params,
        }
        const device = this.getDevice(address)

        if (options && options.sid) {
            // If we have a sub-device set it (used by Lumi Smart Home Gateway)
            request.sid = options.sid
        }

        return new Promise<T>((resolve, reject) => {
            let resolved = false

            // Handler for incoming messages
            const promise = {
                resolve: (res: T) => {
                    resolved = true
                    device._promises.delete(request.id)

                    resolve(res)
                },
                reject: (err: any) => {
                    resolved = true
                    device._promises.delete(request.id)

                    if (
                        !(err instanceof Error) &&
                        typeof err.code !== 'undefined'
                    ) {
                        const { code, message } = err
                        err = new Error(message)
                        err.code = code
                    }
                    reject(err)
                },
            }

            let retriesLeft = Math.max(0, options.retries ?? this.retries)
            const retry = () => {
                if (resolved) return
                if (retriesLeft-- > 0) {
                    send()
                } else {
                    const msg = `${address} <- Reached maximum number of retries, giving up ${method} - ${JSON.stringify(
                        params
                    )}`
                    if (options.suppress) {
                        this.log.trace(msg)
                    } else {
                        this.log.error(msg)
                    }
                    const err: any = new Error('Call to device timed out')
                    err.code = 'timeout'
                    promise.reject(err)
                }
            }

            const send = () => {
                this.handshake(address)
                    .catch((err) => {
                        if (err.code === 'timeout') {
                            this.log.debug(`${address} <- Handshake timed out`)
                            retry()
                            return false
                        }
                        throw err
                    })
                    .then(() => {
                        // Assign the identifier before each send
                        let id
                        if (request.id) {
                            /*
                             * This is a failure, increase the last id. Should
                             * increase the chances of the new request to
                             * succeed. Related to issues with the vacuum
                             * not responding such as described in issue #94.
                             */
                            id = device._lastId + 100

                            // Make sure to remove the failed promise
                            device._promises.delete(request.id)
                        } else {
                            id = device._lastId + 1
                        }

                        // Check that the id hasn't rolled over
                        if (id >= 10000) {
                            id = 1
                        }
                        device._lastId = id

                        // Assign the identifier
                        request.id = id

                        // Store reference to the promise so reply can be received
                        device._promises.set(id, promise)

                        // Create the JSON and send it
                        this.log.trace(
                            `${address} <- (${retriesLeft}) ${JSON.stringify(
                                request
                            )}`
                        )

                        this._send(address, request).catch(promise.reject)

                        // Queue a retry
                        setTimeout(retry, this.timeout)
                    })
                    .catch(promise.reject)
            }

            send()
        })
    }
}

class Singleton {
    private static instance: MiProtocol

    constructor() {
        if (!Singleton.instance) {
            Singleton.instance = new MiProtocol()
        }
    }

    getInstance() {
        return Singleton.instance
    }

    static getInstance() {
        return Singleton.instance
    }
}

export default Singleton

export { Singleton as MiProtocol }
