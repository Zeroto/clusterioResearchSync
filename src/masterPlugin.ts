import { Socket, Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import util from 'util';

type MasterPluginArguments = {
  config: any,
  pluginConfig: any,
  pluginPath: string,
  socketio: Server,
  express: any
}

type Researcher = {
  id: number,
  currentResearch: string
}

class masterPlugin {
  config:any;
  pluginConfig: any;
  pluginPath: string;
  io: Server;
  app: any;

  researchers: Map<number, Researcher>
  technologies: Map<string, number>
  technologiesDatabasePath: string;
	constructor({config, pluginConfig, pluginPath, socketio, express}:MasterPluginArguments){
    this.config = config;
		this.pluginConfig = pluginConfig;
		this.pluginPath = pluginPath;
		this.io = socketio;
    this.app = express;

    this.researchers = new Map<number, Researcher>();

    this.technologiesDatabasePath = path.join(this.config.databaseDirectory, "technologies.json");
    const technologiesDatabase = getDatabaseSync(this.technologiesDatabasePath, []);
    this.technologies = new Map(technologiesDatabase);
    
    this.io.on("connection", (socket:Socket) => {
      socket.on('registerResearcher', (data: {instanceId: number, currentResearch: string}) => {
        console.log(`registering new research client: ${data.instanceId}`);
        this.researchers.set(data.instanceId, {
          id: data.instanceId,
          currentResearch: data.currentResearch
        });
        socket.emit('technologies', Array.from(this.technologies.entries()));
      });

      socket.on('progress', (data: {research: string, delta: number}) => {
        if (this.getTechProgress(data.research) < 1) {
          const newProgress = (this.getTechProgress(data.research) || 0) + data.delta;
          this.technologies.set(data.research, newProgress);
          console.log(`progress: ${data.research}, ${data.delta}, ${this.getTechProgress(data.research)}`)
          // we need to broadcast this out
          this.io.sockets.emit('progress', {research: data.research, progress: newProgress})
          // also save to file
          saveDatabase(this.technologiesDatabasePath, Array.from(this.technologies.entries()));
        }
      });
    });
  }

  getTechProgress(name: string){
    return this.technologies.get(name) || 0;
  }
}

function getDatabaseSync(path:string, defaultValue: any){
	try {
		return JSON.parse(fs.readFileSync(path, "utf8"));
	} catch(e){
		return defaultValue;
	}
}

async function saveDatabase(path: string, database: any){
  const writeFileAsync = util.promisify(fs.writeFile);
	if(!path){
		throw new Error("No path provided!");
	} else if(!database){
		throw new Error("No database provided!");
	} else {
		try {
			await writeFileAsync(path, JSON.stringify(database));
		} catch(e){
			throw new Error("Unable to write to database! "+path);
		}
	}
}

export = masterPlugin;