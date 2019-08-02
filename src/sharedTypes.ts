export type Progress = {progress: number, level: number}
export type Technology = [string,Progress]
export type ServerToClientProgress = { research: string, progress: number, level: number }
export type ClientToServerProgress = { research: string, level: number, delta: number}