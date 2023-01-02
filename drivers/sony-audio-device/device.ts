import axios from 'axios';
import Homey from 'homey';
import { parseStringPromise } from 'xml2js';
import { SonyAudioControlApi } from './sony-audio-control-api';

class SonyAudioDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  client = new SonyAudioControlApi();
  connected = false;

  async onInit() {
    this.log('SonyAudioDevice has been initialized');
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
    this.client.setBaseUri(this.getStore().baseUrl);
    this.client.connect();
    // // This method will be executed once when the device has been found (onDiscoveryResult returned true)
  }

  async onDiscoveryAddressChanged(discoveryResult: any) {
    this.log("onDiscoveryAddressChanged");

    const result = await axios.get((discoveryResult as any).headers.location);
    const data = await parseStringPromise(result.data);
    const baseUrl = data.root.device[0]['av:X_ScalarWebAPI_DeviceInfo'][0]['av:X_ScalarWebAPI_BaseURL'][0];
    this.setStoreValue('baseUrl',baseUrl);
    this.client.disconnect();
    this.client.setBaseUri(baseUrl);
    this.client.connect();
    // // Update your connection details here, reconnect when the device is offline
    // this.api.address = discoveryResult.address;
    // this.api.reconnect().catch(this.error); 
  }

  onDiscoveryLastSeenChanged(discoveryResult: any) {
    this.log("onDiscoveryLastSeenChanged");

    // // When the device is offline, try to reconnect here
    // this.api.reconnect().catch(this.error); 
    this.client.connect();
  }


}

module.exports = SonyAudioDevice;
