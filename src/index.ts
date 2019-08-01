import pluginConfig from './config.json';
import {getSafeLua, checkHotpatchInstallation} from './util';
import { MessageInterface } from './clusterio';

class ResearchSync {
  messageInterface: MessageInterface;
  config: any;
  socket: any;
  technologies: Map<string, number>;
  currentResearch: string;

  constructor(slaveConfig: any, messageInterface: MessageInterface, extras: {socket: any}) {
    this.config = slaveConfig;
    this.messageInterface = messageInterface;
    this.socket = extras.socket;

    this.currentResearch = "";
    this.technologies = new Map<string, number>() // get this from master at start

    this.init();
  }

  async init() {
    await this.installHotpatchMod();
    this.currentResearch = (await this.getCurrentResearch()).trim();
    console.log('currentResearch', this.currentResearch)
    this.socket.on('hello', () => this.socketRegister());
    this.socket.on('technologies', (data: Array<[string, number]>) => this.receiveTechnologies(data));
    this.socket.on('progress', (data:{research: string, progress: number}) => {
      console.log(`Received progress: ${JSON.stringify(data)}`);
      this.technologies.set(data.research, data.progress);
      if (this.currentResearch !== data.research) { // we only update the progress for non-active technologies. The current research will be updated in the getProgress loop
        this.messageInterface(`/silent-command rcon.print(remote.call('researchSync', 'updateProgress', '${data.research}', ${data.progress}))`)
      }
    });
  }

  async receiveTechnologies(data: Array<[string, number]>) {
    this.technologies = new Map(data);
      // update the techs
      for (const [key, value] of this.technologies) {
        await this.messageInterface(`/silent-command rcon.print(remote.call('researchSync', 'updateProgress', '${key}', ${value}))`)
      }
      setInterval(() => this.getProgress(this.currentResearch), 5000);
  }

  async installHotpatchMod() {
    const hotpatchInstallStatus = await checkHotpatchInstallation(this.messageInterface);
    if (!hotpatchInstallStatus) {
      await this.messageInterface("Hotpatch isn't installed! Hotpatch is required to use ResearchSync");
      return;
    }

    const controlCode = await getSafeLua("sharedPlugins/researchSync/lua/control.lua");
    if (!controlCode) {
      await this.messageInterface("Could not load research sync control code. Aborting.");
      return;
    }
    
    const hotpatchUpdateCommand = `/silent-command remote.call('hotpatch', 'update', '${pluginConfig.name}', '${pluginConfig.version}', '${controlCode}')`
    const result = await this.messageInterface(hotpatchUpdateCommand);
    if (result) console.log('ResearchSync hotpatch install result: ', result);
  }
  
  socketRegister() {
    this.socket.emit('registerResearcher', {
      instanceId: this.config.unique,
      currentResearch: this.currentResearch
    });
  }

  scriptOutput(data:string) {
    console.log(`Got script output: ${data}`)
    const lines = data.split('\n');
    for (let i = 0; i< lines.length; i++) {
      const line = lines[i];
      const type = line.substring(0,2);
      const research = line.substring(2);
      console.log(type, research);
      if (type === 's ') {
        this.currentResearch = research;
      }
      else if (type === 'f ') {
        if (research === this.currentResearch) {
          // we finished the research. Send remaining progress
          const delta = 1.1 - (this.technologies.get(this.currentResearch) || 0); // we overestimate the delta to make sure that we end up as > 1
          this.socket.emit('progress', {
            research: this.currentResearch,
            delta
          });
          this.currentResearch = "";
        }
      }
    }
  }

  async getProgress(currentResearch: string) {
    if (currentResearch) {
      const currentProgress = this.technologies.get(currentResearch) || 0;
      const delta = parseFloat(await this.messageInterface(`/silent-command rcon.print(remote.call('researchSync', 'updateProgress', '${currentResearch}', ${currentProgress}))`));
      this.technologies.set(currentResearch, (this.technologies.get(currentResearch) || 0) + delta);
      console.log(`research: ${currentResearch}, delta: ${delta}, progress: ${this.technologies.get(currentResearch)}`)
      if (delta > 0) {
        this.socket.emit('progress', {
          research: currentResearch,
          delta
        });
      }
    }
  }

  async getCurrentResearch() {
    return await this.messageInterface(`/silent-command rcon.print(remote.call('researchSync', 'getCurrentResearch'))`);
  }
}

export = ResearchSync;
