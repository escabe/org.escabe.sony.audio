import axios from "axios";
import * as websocket from 'websocket';

export class SonyAudioControlApi {
    private baseUri: string = '';
    private connected: boolean = false;
    private idCounter = 1;
    private services: string[] | undefined;
    private wss: any;

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
            return out[service] = this.connectToService(service);
        },{})
        this.connected = true;
    }

    public disconnect() {
        Object.values(this.wss).forEach((ws: any)=>{
            ws.disconnect();
        });
        this.connected = false;
        this.wss = {};
    }

    private connectToService(service: string): websocket.client {
        const client = new websocket.client();
        
        client.on('connectFailed',(err) => {
            console.log(service + " connectFailed " + err);
        })

        client.on('connect',(connection) => {
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
                        // Standard notifications
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