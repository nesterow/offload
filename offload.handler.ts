import type { WorkerResponse, WorkerRequest } from "./offload.interface";

declare var self: Worker;

type HandlerCallback<T, E> = ((data: E) => T) | ((data: E) => Awaited<T>);

export async function handler<T, E>(fn: HandlerCallback<T, E>): Promise<void> {
  self.addEventListener("message", async (event) => {
    const request = event.data as WorkerRequest<E>;
    const result = await fn(request.params);
    const response: WorkerResponse<T> = { id: request.id, value: result };
    self.postMessage(response);
  });
}
