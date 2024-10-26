// offload.error.ts
class OffloadError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "OffloadError";
  }
}
// offload.handler.ts
async function handler(fn) {
  self.addEventListener("message", async (event) => {
    const request = event.data;
    const result = await fn(request.params);
    const response = { id: request.id, value: result };
    self.postMessage(response);
  });
}
// offload.ts
var workerId = Symbol("workerId");
var workerTasks = new Map;
function offload(url, poolSize = 1, mode = "cb") {
  switch (mode) {
    case "bg":
      return createPooledCallback(poolSize, () => {
        const bg = withMessageInterceptor(new Worker(url.toString()));
        const bgcb = createTaskCallback(bg);
        return bgcb;
      });
    default:
      return createBufferedCallback(poolSize, () => {
        const worker = withMessageInterceptor(new Worker(url.toString()));
        const cb = createTaskCallback(worker, () => {
          worker.terminate();
        });
        return cb;
      });
  }
}
function createTaskCallback(worker, eof) {
  const cb = async function(data) {
    const id = createTaskId();
    const errorCallback = (event) => {
      const error = event.message;
      workerTasks.get(worker)?.get(id)?.reject(new OffloadError(error, id));
      workerTasks.get(worker)?.delete(id);
    };
    worker.addEventListener("error", errorCallback, { once: true });
    const workerTask = Promise.withResolvers();
    workerTasks.get(worker)?.set(id, workerTask);
    const request = { id, params: data };
    worker.postMessage(request);
    try {
      const result = await workerTask.promise;
      workerTasks.get(worker)?.delete(id);
      if (eof)
        eof();
      worker.removeEventListener("error", errorCallback);
      return result;
    } catch (error) {
      workerTasks.get(worker)?.delete(id);
      if (eof)
        eof();
      worker.removeEventListener("error", errorCallback);
      throw error;
    }
  };
  cb[workerId] = worker;
  return cb;
}
function createBufferedCallback(bufSize, fun) {
  let free = bufSize;
  const waitFree = async () => {
    if (free <= 0) {
      await new Promise((resolve) => setTimeout(resolve));
      return await waitFree();
    }
  };
  const spots = [];
  const term = () => {
    for (const cb of spots) {
      if (cb)
        terminate(cb);
    }
  };
  const call = async (data) => {
    if (free <= 0)
      await waitFree();
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
function createPooledCallback(poolSize, fun) {
  let free = poolSize;
  const waitFree = async () => {
    if (free <= 0) {
      await new Promise((resolve) => setTimeout(resolve));
      return await waitFree();
    }
  };
  const spots = [];
  for (let i = 0;i < poolSize; i++) {
    spots[i] = fun();
  }
  const term = () => {
    for (const cb of spots) {
      terminate(cb);
    }
  };
  const call = async (data) => {
    if (free <= 0)
      await waitFree();
    --free;
    const cb = spots[0];
    const result = await cb(data);
    free++;
    return result;
  };
  return [call, term];
}
function useWorker(cb) {
  return cb[workerId];
}
function terminate(cb) {
  const worker = useWorker(cb);
  worker.terminate();
}
function createTaskId() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}
function withMessageInterceptor(worker) {
  const promiseTable = new Map;
  workerTasks.set(worker, promiseTable);
  worker.onmessage = (event) => {
    const { id, value } = event.data;
    promiseTable.get(id)?.resolve(value);
    promiseTable.delete(id);
  };
  return worker;
}
export {
  offload,
  handler,
  OffloadError
};
