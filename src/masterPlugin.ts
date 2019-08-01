type MasterPluginArguments = {
  config: any,
  pluginConfig: any,
  pluginPath: string,
  socketio: any,
  express: any
}

type Researcher = {
  id: number,
  currentResearch: string
}

class masterPlugin {
  config:any;
  pluginConfig: any;
  pluginPath: any;
  io: any;
  app: any;

  researchers: Map<number, Researcher>
  technologies: Map<string, number>
	constructor({config, pluginConfig, pluginPath, socketio, express}:MasterPluginArguments){
    this.config = config;
		this.pluginConfig = pluginConfig;
		this.pluginPath = pluginPath;
		this.io = socketio;
    this.app = express;

    this.researchers = new Map<number, Researcher>();
    this.technologies = new Map<string, number>();
    
    this.io.on("connection", (socket:any) => {
      socket.on('registerResearcher', (data: {instanceId: number, currentResearch: string}) => {
        console.log(`registering new research client: ${data.instanceId}`);
        this.researchers.set(data.instanceId, {
          id: data.instanceId,
          currentResearch: data.currentResearch
        });
        socket.emit('technologies', Array.from(this.technologies.entries()));
      });

      socket.on('progress', (data: {research: string, delta: number}) => {
        this.technologies.set(data.research, (this.technologies.get(data.research) || 0) + data.delta);
        console.log(`progress: ${data.research}, ${data.delta}, ${this.technologies.get(data.research)}`)
      });
    });
  }
}

export = masterPlugin;