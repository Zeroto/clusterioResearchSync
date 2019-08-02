import pluginConfig from './config.json';
import { getSafeLua, checkHotpatchInstallation } from './util';
import { MessageInterface } from './clusterio';
import { Technology, ServerToClientProgress, ClientToServerProgress } from './sharedTypes';
import { Socket } from 'socket.io';

type Research = {research: string, level: number}

class ResearchSync {
  messageInterface: MessageInterface;
  config: any;
  socket: Socket;
  technologies: Map<string, {progress: number, level: number}>;
  currentResearch: Research | null;

  constructor(slaveConfig: any, messageInterface: MessageInterface, extras: { socket: Socket }) {
    this.config = slaveConfig;
    this.messageInterface = messageInterface;
    this.socket = extras.socket;

    this.currentResearch = null;
    this.technologies = new Map() // get this from master at start

    this.init();
  }

  async init() {
    await this.installHotpatchMod();
    this.currentResearch = (await this.getCurrentResearch());
    console.log('currentResearch', this.currentResearch)
    this.socket.on('hello', () => this.socketRegister());
    this.socket.on('technologies', (data: Array<Technology>) => this.receiveTechnologies(data));
    this.socket.on('progress', (data: ServerToClientProgress) => {
      console.log(`Received progress: ${JSON.stringify(data)}`);
      this.technologies.set(data.research, {progress: data.progress, level: data.level});
      if (!this.currentResearch || this.currentResearch.research !== data.research) { // we only update the progress for non-active technologies. The current research will be updated in the getProgress loop
        this.messageInterface(`/silent-command rcon.print(remote.call('researchSync', 'updateProgress', '${data.research}', ${data.level}, ${data.progress}))`)
      }
    });
  }

  async receiveTechnologies(data: Array<Technology>) {
    this.technologies = new Map(data);
    // update the techs
    for (const [key, value] of this.technologies) {
      await this.messageInterface(`/silent-command rcon.print(remote.call('researchSync', 'updateProgress', '${key}', ${value.level}, ${value.progress}))`)
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

  scriptOutput(data: string) {
    console.log(`Got script output: ${data}`)
    const lines = data.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const data = line.split(' ');
      const research = data[1];
      const level = parseInt(data[2], 10);
      if (data[0] === 's') {
        this.currentResearch = {research, level};
        const currentProgress = this.technologies.get(research) || {progress:0, level: level};
        if (currentProgress.level < level) {
          this.technologies.set(research, {progress: 0, level});
        }
      }
      else if (data[0] === 'f') {
        if (this.currentResearch && research === this.currentResearch.research && level === this.currentResearch.level) {
          // we finished the research. Send remaining progress
          const currentProgress = this.technologies.get(this.currentResearch.research) || {progress:0, level: this.currentResearch.level}
          const delta = 1.1 - currentProgress.progress; // we overestimate the delta to make sure that we end up as > 1
          this.sendProgress(this.currentResearch, delta);
          this.currentResearch = null;
        }
      }
    }
  }

  async getProgress(currentResearch: Research | null) {
    if (currentResearch) {
      let currentProgress = this.technologies.get(currentResearch.research) || {progress:0, level: currentResearch.level};
      const rconCommand = `/silent-command rcon.print(remote.call('researchSync', 'updateProgress', '${currentResearch.research}', ${currentProgress.level}, ${currentProgress.progress}))`;
      const data = await this.messageInterface(rconCommand);
      const delta = parseFloat(data);
      currentProgress = this.technologies.get(currentResearch.research) || {progress:0, level: currentResearch.level}; // we get the latest state. It might have been updated while we were doing the rcon command
      this.technologies.set(currentResearch.research, {progress: currentProgress.progress + delta, level: currentProgress.level});
      console.log(`research: ${JSON.stringify(currentResearch)}, delta: ${delta}, ${JSON.stringify(this.technologies.get(currentResearch.research))}`)
      if (delta > 0) {
        this.sendProgress(currentResearch, delta);
      }
    }
  }

  sendProgress(research: Research, delta: number) {
    const data: ClientToServerProgress = {
      research: research.research,
      level: research.level,
      delta
    };
    this.socket.emit('progress', data);
  }

  async getCurrentResearch() {
    const data = await this.messageInterface(`/silent-command rcon.print(remote.call('researchSync', 'getCurrentResearch'))`);
    if (data.trim()) {
      const split = data.split(' ');
      return {research: split[0], level: parseInt(split[1], 10)}
    }
    else
    {
      return null;
    }
  }
}

export = ResearchSync;
