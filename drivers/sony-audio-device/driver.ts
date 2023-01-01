import axios from 'axios';
import Homey, { DiscoveryResultSSDP } from 'homey';
import { parseStringPromise } from 'xml2js';

class AudioDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('AudioDriver has been initialized');
  }


  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    const discoveryStrategy = this.getDiscoveryStrategy();
    const discoveryResults = discoveryStrategy.getDiscoveryResults();

    const devices = await Promise.all(Object.values(discoveryResults).map(async discoveryResult  => {

      const result = await axios.get((discoveryResult as any).headers.location);
      const data = await parseStringPromise(result.data);
  
      return {
        name: data.root.device[0].friendlyName[0],
        data: {
          id: discoveryResult.id
        },
        store: {
          baseUrl: data.root.device[0]['av:X_ScalarWebAPI_DeviceInfo'][0]['av:X_ScalarWebAPI_BaseURL'][0]
        }
      };
    }));

    return devices;
  }

}

module.exports = AudioDriver;
