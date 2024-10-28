# Offload

Offload heavy tasks using WebWorkers.

Offload creates a limited execution pool and can operate in two modes:
- callback mode (default) - spawns web workers on demand when the function is called, self terminated
- background - runs workers as backround jobs, distributes load among them, must be terminated manually


*Currently uses unstable WebWorkers API.*

## Install:

```bash
bun add github:nesterow/offload # or pnpm
```

## Usage

Offload accepts three positional arguments: worker path, pool size, and operation mode:

```typescript
const [task, terminate] = offload<ReturnType, ParamType>(
  workerPath: string,
  poolSize: number,
  mode?: 'bg' | 'cb'
)
```


Worker's main callback must be wrapped as `handler` and must receive single argument:

```typescript
// print.worker.ts
import { handler } from "@nesterow/offload";
declare var self: Worker;

handler(async (data: string) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(data);
  return true;
});
```

### Callback operation mode

In the callback mode, `print()` will spawn a worker and terminate it after the task is done.
Maximum of `poolSize` workers may be spawned at the same time, the rest will be queued:

```typescript
import { offload } from "@nesterow/offload";

const [print, terminate] = offload<boolean, string>("./print.worker.ts", 5);

await print("Hello, World!"); // => true
```

Callback operatinal mode us useful when thread startup delay doesn't matter.
You don't need to worry about worker termination as it exits after the callback returns result.
This is default "safe" option as it allows to call `offload` in any part of the application.

### Background operation mode

In the background mode, offload will spawn `poolSize` workers, `print()` will distribute the tasks among them:

```typescript
import { offload } from "@nesterow/offload";

const [print, terminate] = offload<boolean, string>("./print.worker.ts", 5, 'bg');

await print("Hello, World!"); // => true

terminate(); // terminate all workers, for example on exit signal
```

Background operation mode is useful when you need to spawn pre-defined number of the threads on application start.
Generally it is more effective as it balances the load among the threads and doesn't have startup delay.

## Types

Because offload doesn't know argument and return types of your worker's handler, you need to pass type arguments manually:

```typescript
const [callback, termiate] = offload<ReturnType, ArgType>("./my.worker.ts", 1);

const arg: ArgType = {};
const result: ReturnType = await callback(arg);
```

## License

MIT
