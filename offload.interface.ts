/**
 * Response from a worker
 */
export type WorkerResponse<T> = { id: number; value: T };
/**
 * Request to a worker
 */
export type WorkerRequest<T> = { id: number; params: T };
