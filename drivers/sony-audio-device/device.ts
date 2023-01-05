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
  albumArt: Homey.Image | undefined;
  async onInit() {
    this.log('SonyAudioDevice has been initialized');
    
    this.albumArt = await this.homey.images.createImage();
    this.setAlbumArtImage(this.albumArt);

    this.client.on('notifyPowerStatus',(status) => {
      this.setCapabilityValue('onoff',status.status === 'active');
    })

    this.client.on('notifyPlayingContentInfo',(info) => {
      if (info.kind === 'input') {
        this.setCapabilityValue('speaker_album','INPUT');
        this.setCapabilityValue('speaker_track',this.sourceMap[info.source] ?? 'UNKNOWN');
        this.setCapabilityValue('speaker_artist','INPUT');
        this.setCapabilityValue('speaker_duration',0);        
        this.setCapabilityValue('speaker_playing',true);
        this.albumArt?.setPath('/assets/hdmi.png');
        this.albumArt?.update();
      } else {
        this.setCapabilityValue('speaker_album',info.albumName ?? '');
        this.setCapabilityValue('speaker_track',info.title ?? '');
        this.setCapabilityValue('speaker_artist',info.artist ?? '');
        this.setCapabilityValue('speaker_duration',info.durationMsec ?? 0);        
        this.setCapabilityValue('speaker_playing',info.stateInfo?.state === 'PLAYING' ?? false);
      }
      if (info.source) {
        this.setCapabilityValue('input_source',info.source);
      }
      if (info.content && info.content.thumbnailUrl) {
          this.albumArt?.setUrl(info.content.thumbnailUrl);
          this.albumArt?.update();
      }
    });

    this.client.on('notifyVolumeInformation',(info)=> {
      this.setCapabilityValue('volume_mute', info.mute == 'on');
      this.setCapabilityValue('volume_set',info.volume);
    });

    this.client.on('notifySettingsUpdate',(info) => {
      switch (info.apiMappingUpdate.target) {
        case 'rearspeakerLevel':
          this.setCapabilityValue('volume_set.rearspeakerLevel',Number.parseInt(info.apiMappingUpdate.currentValue));
          break;
        case 'subwooferLevel':
          this.setCapabilityValue('volume_set.subwooferLevel',Number.parseInt(info.apiMappingUpdate.currentValue));
          break;
        case 'voice':
          this.setCapabilityValue('onoffbutton.voice',info.apiMappingUpdate.currentValue==='on');
          break;
        case 'enhancer':
          this.setCapabilityValue('onoffbutton.soundEnhancer',info.apiMappingUpdate.currentValue==='on');
          break;
        case 'nightMode':
          this.setCapabilityValue('onoffbutton.nightMode',info.apiMappingUpdate.currentValue==='on');
          break;
        case 'soundField':
          this.setCapabilityValue('sound_mode.soundField',info.apiMappingUpdate.currentValue);
          break;    
        case 'avSyncMs':
          this.setCapabilityValue('avsync.avSyncMs',info.apiMappingUpdate.currentValue === '' ? 0 : Number.parseInt(info.apiMappingUpdate.currentValue));
          break;         
      }
    });

    this.registerCapabilityListener('onoff',(value) => {
      this.client.setPowerStatus(value ? 'active' : 'standby');
    });

    this.registerCapabilityListener('volume_mute',(value) => {
      this.client.setMute(value);
    });

    this.registerCapabilityListener('volume_set',(value) => {
      this.client.setVolume(value);
    });    

    this.registerCapabilityListener('volume_up',(value) => {
      this.triggerCapabilityListener('volume_set',this.getCapabilityValue('volume_set')+1);
    });    
    this.registerCapabilityListener('volume_down',(value) => {
      this.triggerCapabilityListener('volume_set',this.getCapabilityValue('volume_set')-1);
    });

    this.registerCapabilityListener('speaker_next',()=>{
      this.client.playNext();
    });

    this.registerCapabilityListener('speaker_prev',()=>{
      this.client.playPrevious();
    });

    this.registerCapabilityListener('speaker_playing',()=>{
      this.client.pausePlay();
    });


    this.registerCapabilityListener('button.radio',() => {
      
    });
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

  sourceMap: any = {
    "extInput:tv": "TV" ,
    "extInput:hdmi?port=1": "HDMI1",
    "extInput:hdmi?port=2": "HDMI2",
    "extInput:btAudio": "Bluetooth Audio",
    "extInput:line" : "Analog",
    "netService:audio" : "Streaming Service",
    "cast:audio": "Cast",
    "extInput:airPlay" : "Airplay" 
  }


}

module.exports = SonyAudioDevice;
