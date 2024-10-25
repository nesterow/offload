export type WorkerResponse<T> = { id: number; value: T };
export type WorkerRequest<T> = { id: number; params: T };
