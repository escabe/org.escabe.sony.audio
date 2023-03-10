import axios from "axios";
import { AnyMxRecord } from "dns";
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

declare interface SettingsUpdate {
    apiMappingUpdate: {
        currentValue: string,
        getApi: any,
        service: string,
        setApi: any,
        target: string
    },
    isAvailable: boolean,
    title: string,
    titleTextID: string,
    type: string
}

export declare interface SonyAudioControlApi {
    on(event: 'notifyPlayingContentInfo', listener: (info: PlayingContentInfo) => void): this;
    on(event: 'notifyVolumeInformation', listener: (info: VolumeInformation) => void): this;
    on(event: 'notifyPowerStatus', listener: (status: PowerStatus) => void): this;
    on(event: 'notifySettingsUpdate', listener: (info: SettingsUpdate) => void): this;
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
        this.connected = true;
    }

    private getInitialValues(connection: websocket.connection, service: string) {
        let req: any;
        switch (service) {
            case 'audio':
                req = {
                    "method":"getVolumeInformation",
                    "id":3,
                    "params":[{}],
                    "version":"1.1"
                };
                connection.sendUTF(JSON.stringify(req));
                
                req = {
                    "method":"getSoundSettings",
                    "id":4,
                    "params":[{}],
                    "version":"1.1"
                };
                connection.sendUTF(JSON.stringify(req));                
                
                break;
            case 'system':
                req = {
                    "method":"getPowerStatus",
                    "id":5,
                    "params":[],
                    "version":"1.1"
                };
                connection.sendUTF(JSON.stringify(req));
                break;
            case 'avContent':
                req = {
                    "method":"getPlayingContentInfo",
                    "id":6,
                    "params":[{}],
                    "version":"1.2"
                };
                connection.sendUTF(JSON.stringify(req));                
                break;
        }
       
    }

    private emitInitialPowerStatus(msg: any) {
        this.emit('notifyPowerStatus',msg.result[0]);
    }

    private emitInitialPlayingContentInfo(msg: any) {
        console.log(msg.result);
        this.emit('notifyPlayingContentInfo',msg.result[0][0]);
    }    

    private emitInitialSoundSettingEvents(msg: any) {
        msg.result[0].forEach((setting:any) => {
          this.emit('notifySettingsUpdate',{
                apiMappingUpdate: {
                    currentValue: setting.currentValue,
                    service: 'audio',
                    target: setting.target
                },
                isAvailable: setting.isAvailable,
                title: setting.title,
                titleTextID: setting.titleTextID,
                type: setting.type
            });  
        });
    }

    private emitInitialVolumeEvent(msg: any) {
        this.emit('notifyVolumeInformation',msg.result[0][0]);
    }


    private enableAllNofications(connection: websocket.connection, msg: any) {
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
    }    

    public disconnect() {
        // Close everything
        Object.values(this.wss).forEach((ws: any)=>{
            try {
                ws.disconnect();
            } catch {

            }
        });
        this.connected = false;
        // Clear all references to anything
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

    public playNext() {
        const req = {
            "method":"setPlayNextContent",
            "id":2,
            "params":[{}],
            "version":"1.0"
        };
        this.wsc.avContent.sendUTF(JSON.stringify(req));
    }

    public playPrevious() {
        const req = {
            "method":"setPlayPreviousContent",
            "id":2,
            "params":[{}],
            "version":"1.0"
        };
        this.wsc.avContent.sendUTF(JSON.stringify(req));        
    }

    public stopPlay() {
        const req = {
            "method":"stopPlayingContent",
            "id":2,
            "params":[{}],
            "version":"1.1"
        };
        this.wsc.avContent.sendUTF(JSON.stringify(req));        
    }

    public pausePlay() {
        const req = {
            "method":"pausePlayingContent",
            "id":2,
            "params":[{}],
            "version":"1.1"
        };
        this.wsc.avContent.sendUTF(JSON.stringify(req));            
    }

        
    private connectToService(service: string): websocket.client {
        const client = new websocket.client();
        
        client.on('connectFailed',(err) => {
            console.log(service + " connectFailed " + err);
        })

        client.on('connect',(connection) => {
            this.wsc[service] = connection;
            this.getInitialValues(connection,service);
            console.log(service + ' connected');
            connection.on('close',()=>{
                console.log(service + ' disconnected');
                this.disconnect();
            });
            connection.on('message',(message)=>{
                if (message.type === 'utf8') {
                    const msg = JSON.parse(message.utf8Data);
                    console.log(msg);
                    switch (msg.id) {
                        case 1:
                            this.enableAllNofications(connection,msg);
                            break;
                        case 2:
                            // Verify nothing disabled
                            break;
                        case 3:
                            // Convert info into events
                            this.emitInitialVolumeEvent(msg);       
                            break;
                        case 4:
                            // Convert info into events
                            this.emitInitialSoundSettingEvents(msg);                
                            break;
                        case 5:
                            this.emitInitialPowerStatus(msg);
                            break;
                        case 6:
                            this.emitInitialPlayingContentInfo(msg);
                            break;
                        default:
                            this.emit(msg.method,msg.params[0]);
                            break;
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