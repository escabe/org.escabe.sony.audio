import axios from 'axios';
import Homey from 'homey';
import { client } from 'websocket';
import { parseStringPromise } from 'xml2js';

class SonyAudioDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  wsclient = new client();
  connected = false;



  async onInit() {
    this.log('SonyAudioDevice has been initialized');

    this.wsclient.on('connectFailed',(err)=> {
      this.log('CONNECTION FAILED: ' + err);
    });
    this.wsclient.on('connect',(connection) => {
      this.log('CONNECTED');
      this.connected = true;
      connection.on('close',()=>{
        this.log('DISCONNECTED');
        this.connected = false;

      });
      connection.on('message',(message)=>{
        if (message.type === 'utf8') {
          this.log('MESSAGE: ' + message.utf8Data);
          const msg = JSON.parse(message.utf8Data);
          if (msg.id == 1){
            let all_notifications = msg.result[0].disabled.concat(msg.result[0].enabled);
            let enable: Array<any> = [];
            let disable: Array<any> = [];
            // Enable only the 'notifyVolumeInformation' notifications.
            all_notifications.forEach(
              (item: any)  => item.name == "notifyVolumeInformation"
              ? enable.push(item) : disable.push(item) );
            // Use a different ID than '1', to avoid creating a loop.
            this.log(JSON.stringify(this.switchNotifications(2,disable,enable)));
            connection.sendUTF(JSON.stringify(this.switchNotifications(2,disable,enable)));
          } else {

          }          
        }
      });
      this.log('SUBSCRIBE');
      connection.sendUTF(JSON.stringify(this.switchNotifications(1,[],[])));
    });
  }
  
  switchNotifications(id: number,disable: any,enable: any){
    let v:any =  {
      "method": "switchNotifications",
      "id": id,
      "params": [{}],
      "version": "1.0"
    }
    if (disable.length > 0) {
      v.params[0].disabled = disable;
    }
    if (enable.length > 0) {
      v.params[0].enabled = enable;
    }
    return v;
  }

  connect() {
    this.log('CONNECTING');
    this.wsclient.connect(this.getStore().baseUrl.replace('http','ws') + '/audio');
    
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('SonyAudioDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings: {}, newSettings: {}, changedKeys: [] }): Promise<string|void> {
    this.log('SonyAudioDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('SonyAudioDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('SonyAudioDevice has been deleted');
  }

  onDiscoveryResult(discoveryResult: any) {
    this.log("onDiscoveryResult");
    this.log(discoveryResult.id === this.getData().id);
    // Return a truthy value here if the discovery result matches your device.
    return discoveryResult.id === this.getData().id;
  }

  async onDiscoveryAvailable(discoveryResult: any) {
    this.log("onDiscoveryAvailable");
    this.log(discoveryResult);
    this.connect();
    // // This method will be executed once when the device has been found (onDiscoveryResult returned true)
    // this.api = new SonyAudioDeviceAPI(discoveryResult.address);
    // await this.api.connect(); // When this throws, the device will become unavailable.
  }

  async onDiscoveryAddressChanged(discoveryResult: any) {
    this.log("onDiscoveryAddressChanged");

    const result = await axios.get((discoveryResult as any).headers.location);
    const data = await parseStringPromise(result.data);
    const baseUrl = data.root.device[0]['av:X_ScalarWebAPI_DeviceInfo'][0]['av:X_ScalarWebAPI_BaseURL'][0];
    this.setStoreValue('baseUrl',baseUrl);
    this.connect();
    // // Update your connection details here, reconnect when the device is offline
    // this.api.address = discoveryResult.address;
    // this.api.reconnect().catch(this.error); 
  }

  onDiscoveryLastSeenChanged(discoveryResult: any) {
    this.log("onDiscoveryLastSeenChanged");

    // // When the device is offline, try to reconnect here
    // this.api.reconnect().catch(this.error); 
    if (!this.connected) {
      this.connect();
    }
  }


}

module.exports = SonyAudioDevice;
