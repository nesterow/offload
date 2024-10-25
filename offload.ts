import type { WorkerResponse, WorkerRequest } from "./offload.interface";
import { OffloadError } from "./offload.error";

type URLlike = URL | string;
type Callback<T, E> = (data: E) => Promise<T>;
type Terminator = () => void; // 🦾
type Id = number;
type PromiseTable = Map<
  Id,
  { resolve: (value: any) => void; reject: (reason: unknown) => void }
>;
type TaskCallback<T, E> = ((data: E) => Promise<T>) & { [workerId]: Worker };
type WorkerTasks = Map<Worker, PromiseTable>;

const workerId = Symbol("workerId");
const workerTasks: WorkerTasks = new Map();

/**
 * OffloadMode
 * 'cb' - (default) callback mode, spawns a worker on call and terminates it upon completion
 * 'bg' - runs a max number of workers of poolSize constantly in background, balances callbacks among them
 */
export type OffloadMode = "cb" | "bg";

/**
 * offload - offload a tasks to a worker
 */
export function offload<Return, Param>(
  url: URLlike,
  poolSize = 1,
  mode: OffloadMode = "cb",
): [Callback<Return, Param>, Terminator] {
  switch (mode) {
    case "bg":
      return createPooledCallback(poolSize, () => {
        const bg = withMessageInterceptor(new Worker(url.toString()));
        const bgcb = createTaskCallback<Return, Param>(bg);
        return bgcb;
      });
    default:
      return createBufferedCallback(poolSize, () => {
        const worker = withMessageInterceptor(new Worker(url.toString()));
        const cb = createTaskCallback<Return, Param>(worker, () => {
          worker.terminate();
        });
        return cb;
      });
  }
}

function createTaskCallback<T, E>(
  worker: Worker,
  eof?: () => void,
): TaskCallback<T, E> {
  const cb = async function (data: E): Promise<T> {
    const id = createTaskId();
    worker.addEventListener(
      "error",
      (event) => {
        const error = event.message;
        workerTasks.get(worker)?.get(id)?.reject(new OffloadError(error, id));
        workerTasks.get(worker)?.delete(id);
      },
      { once: true },
    );
    const workerTask = Promise.withResolvers<T>();
    workerTasks.get(worker)?.set(id, workerTask);
    const request: WorkerRequest<E> = { id, params: data };
    worker.postMessage(request);
    try {
      const result = await workerTask.promise;
      workerTasks.get(worker)?.delete(id);
      if (eof) eof();
      return result;
    } catch (error) {
      workerTasks.get(worker)?.delete(id);
      if (eof) eof();
      throw error;
    }
  };
  cb[workerId] = worker;
  return cb;
}

function createBufferedCallback<T, E>(
  bufSize: number,
  fun: () => TaskCallback<T, E>,
): [Callback<T, E>, Terminator] {
  let free = bufSize;
  const waitFree = async () => {
    if (free <= 0) {
      await new Promise((resolve) => setTimeout(resolve));
      return await waitFree();
    }
  };
  const spots: TaskCallback<T, E>[] = [];
  const term = () => {
    for (const cb of spots) {
      if (cb) terminate(cb);
    }
  };
  const call = async (data: E) => {
    if (free <= 0) await waitFree();
    --free;
    const cb = fun();
    spots[free] = cb;
    const result = await cb(data);
    delete spots[free];
    free++;
    return result;
  };
  return [call, term];
}

function createPooledCallback<T, E>(
  poolSize: number,
  fun: () => TaskCallback<T, E>,
): [Callback<T, E>, Terminator] {
  let free = poolSize;
  const waitFree = async () => {
    if (free <= 0) {
      await new Promise((resolve) => setTimeout(resolve));
      return await waitFree();
    }
  };
  const spots: TaskCallback<T, E>[] = [];
  for (let i = 0; i < poolSize; i++) {
    spots[i] = fun();
  }
  const term = () => {
    for (const cb of spots) {
      terminate(cb);
    }
  };
  const call = async (data: E) => {
    if (free <= 0) await waitFree();
    --free;
    const cb = spots[0];
    const result = await cb(data);
    free++;
    return result;
  };
  return [call, term];
}

function useWorker<T, E>(cb: TaskCallback<T, E>): Worker {
  return cb[workerId];
}

function terminate<T, E>(cb: TaskCallback<T, E>): void {
  const worker = useWorker(cb);
  worker.terminate();
}

function createTaskId(): Id {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function withMessageInterceptor(worker: Worker): Worker {
  const promiseTable: PromiseTable = new Map();
  workerTasks.set(worker, promiseTable);
  worker.addEventListener("message", (event) => {
    const { id, value } = event.data as WorkerResponse<unknown>;
    promiseTable.get(id)?.resolve(value);
    promiseTable.delete(id);
  });
  return worker;
}
