import axios from "axios";
import events from "events";
import * as websocket from 'websocket';

declare interface PlayingContentInfo {
    kind: string,
    albumName:string,
    artist:string,
    contentKind:string,
    output:string,
    source:string,
    stateInfo: {
     state:string
    },
    title:string,
    uri:string,
    content: {
        thumbnailUrl:string
    },
    durationMsec: number,
    service: string
}

enum onoff {
    On = 'on',
    Off = 'off'
}

declare interface VolumeInformation {
    mute: onoff,
    output: string,
    volume: number
}

declare interface PowerStatus {
    standbyDetail: string,
    status: string
}

export declare interface SonyAudioControlApi {
    on(event: 'notifyPlayingContentInfo', listener: (info: PlayingContentInfo) => void): this;
    on(event: 'notifyVolumeInformation', listener: (info: VolumeInformation) => void): this;
    on(event: 'notifyPowerStatus', listener: (status: PowerStatus) => void): this;
}

export class SonyAudioControlApi extends events.EventEmitter {
    private baseUri: string = '';
    private connected: boolean = false;
    private idCounter = 1;
    private services: string[] | undefined;
    private wss: any;
    private wsc: any = {};

    public isConnected(): boolean {
        return this.connected;
    }

    public setBaseUri(uri: string): void {
        this.baseUri = uri;
    }

    public async connect(): Promise<void> {
        if (this.connected) {
            return
        }
        this.services = await this.getAllServices();
        this.wss = this.services.reduce((out:any,service)=>{
            out[service] = this.connectToService(service);
            return out;
        },{})
        console.log(this.wss);
        this.connected = true;
    }

    public disconnect() {
        Object.values(this.wss).forEach((ws: any)=>{
            ws.disconnect();
        });
        this.connected = false;
        this.wss = {};
        this.wsc = {};
    }

    public setMute(mute: boolean): void {
        const req = {
            "method":"setAudioMute",
            "id":2,
            "params":[
                {
                "mute": mute ? 'on' : 'off'
                }
            ],
            "version":"1.1"
        }     
        this.wsc.audio.sendUTF(JSON.stringify(req));
    }
    
    public setVolume(volume: number): void {
        const req = {
            "method":"setAudioVolume",
            "id":2,
            "params":[
                {
                "volume": volume.toString()
                }
            ],
            "version":"1.1"
        }     
        this.wsc.audio.sendUTF(JSON.stringify(req));
    }    

    public setPowerStatus(status: string): void {
        const req = {
            "method":"setPowerStatus",
            "id":2,
            "params":[
                {
                "status": status
                }
            ],
            "version":"1.1"
        }     
        this.wsc.system.sendUTF(JSON.stringify(req));        
    }

    private connectToService(service: string): websocket.client {
        const client = new websocket.client();
        
        client.on('connectFailed',(err) => {
            console.log(service + " connectFailed " + err);
        })

        client.on('connect',(connection) => {
            this.wsc[service] = connection;
            console.log(service + ' connected');
            connection.on('close',()=>{
                console.log(service + ' disconnected');
                this.connected = false;
            });
            connection.on('message',(message)=>{
                if (message.type === 'utf8') {
                    const msg = JSON.parse(message.utf8Data);
                    console.log(msg);
                    if (msg.id == 1) {
                        // Enable all notifications
                        const req = {
                            "method": "switchNotifications",
                            "id": 2,
                            "params": [
                                {
                                    enabled: msg.result[0].disabled.concat(msg.result[0].enabled)
                                }
                            ],
                            "version": "1.0"
                        };
                        connection.sendUTF(JSON.stringify(req));
                    } else if (msg.id == 2) {
                        // Verify nothing disabled
                    } else {
                        this.emit(msg.method,msg.params[0]);
                    }
                }
            });
            // Upon connection find all notifications
            const req = {
                "method": "switchNotifications",
                "id": 1,
                "params": [{}],
                "version": "1.0"        
            }
            connection.sendUTF(JSON.stringify(req));
        });
        // Actually connect
        client.connect(this.baseUri.replace('http','ws') + "/" + service);
        return client;
    }

    private getId(): number {
        return this.idCounter++;
    }

    private async getAllServices(): Promise<string[]> {
        const result = await axios.post(this.baseUri + "/guide",{
            "method": "getSupportedApiInfo",
            "id": this.getId(),
            "params":[{}],
            "version": "1.0"
        });
        return result.data.result[0].map( (r: any) =>r.service);
    }


}