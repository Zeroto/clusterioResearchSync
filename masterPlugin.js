class masterPlugin {
	constructor({config, pluginConfig, pluginPath, socketio, express}){
    this.config = config;
		this.pluginConfig = pluginConfig;
		this.pluginPath = pluginPath;
		this.io = socketio;
    this.app = express;

    this.researchers = {};
    this.technologies = {};
    
    this.io.on("connection", socket => {
      socket.on('registerResearcher', data => {
        console.log(`registering new research client: ${data.instanceId}`);
        this.researchers[data.instanceId] = {
          id: data.instanceId,
          currentResearch: data.currentResearch
        }
        socket.emit('technologies', this.technologies);
      });

      socket.on('progress', data => {
        this.technologies[data.research] = (this.technologies[data.research] || 0) + data.delta;
        console.log(`progress: ${data.research}, ${data.delta}, ${this.technologies[data.research]}`)
      });
    });
  }
}

module.exports = masterPlugin;