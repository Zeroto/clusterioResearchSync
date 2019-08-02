import { Socket, Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { Technology, ClientToServerProgress, ServerToClientProgress, Progress } from './sharedTypes';

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
  config: any;
  pluginConfig: any;
  pluginPath: string;
  io: Server;
  app: any;

  researchers: Map<number, Researcher>
  technologies: Map<string, Progress>
  technologiesDatabasePath: string;
  constructor({ config, pluginConfig, pluginPath, socketio, express }: MasterPluginArguments) {
    this.config = config;
    this.pluginConfig = pluginConfig;
    this.pluginPath = pluginPath;
    this.io = socketio;
    this.app = express;

    this.researchers = new Map();

    this.technologiesDatabasePath = path.join(this.config.databaseDirectory, "technologies.json");
    const technologiesDatabase = getDatabaseSync(this.technologiesDatabasePath, []);
    this.technologies = new Map(technologiesDatabase);

    this.io.on("connection", (socket: Socket) => {
      socket.on('registerResearcher', (data: { instanceId: number, currentResearch: string }) => {
        console.log(`registering new research client: ${data.instanceId}`);
        this.researchers.set(data.instanceId, {
          id: data.instanceId,
          currentResearch: data.currentResearch
        });
        this.sendTechnologies(socket, Array.from(this.technologies.entries()));
      });

      socket.on('progress', (data: ClientToServerProgress) => {
        const oldProgress = this.getTechProgress(data.research) || {progress: 0, level: data.level};

        // don't perform update of progress when the tech is already researched
        if (oldProgress.level > data.level) {
          return;
        }
        if (oldProgress.level === data.level && oldProgress.progress >= 1) {
          return;
        }
        
        const newProgress = {progress: oldProgress.level < data.level ? data.delta : oldProgress.progress + data.delta, level: data.level};
        this.technologies.set(data.research, newProgress);
        console.log(`progress: ${data.research}, ${data.delta}, ${JSON.stringify(this.getTechProgress(data.research))}`)
        // we need to broadcast this out
        this.broadcastProgress({ research: data.research, progress: newProgress.progress, level: newProgress.level })
        // also save to file
        saveDatabase(this.technologiesDatabasePath, Array.from(this.technologies.entries()));
      });
    });
  }

  sendTechnologies(socket: Socket, technologies: Technology[]) {
    socket.emit('technologies', technologies);
  }

  broadcastProgress(progress: ServerToClientProgress) {
    this.io.sockets.emit('progress', progress)
  }

  getTechProgress(name: string) {
    return this.technologies.get(name);
  }
}

function getDatabaseSync(path: string, defaultValue: any) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (e) {
    return defaultValue;
  }
}

const writeFileAsync = util.promisify(fs.writeFile);
async function saveDatabase(path: string, database: any) {
  if (!path) {
    throw new Error("No path provided!");
  } else if (!database) {
    throw new Error("No database provided!");
  } else {
    try {
      await writeFileAsync(path, JSON.stringify(database));
    } catch (e) {
      throw new Error("Unable to write to database! " + path);
    }
  }
}

export = masterPlugin;