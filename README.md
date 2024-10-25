# Offload

Offload cpu-itensive tasks using WebWorkers. Offload creates a limited execution pool and can operate in two modes:
- callback mode (default) - spawns web workers on demand when the function is called, self terminated
- background - runs workers as backround jobs, distributes load among them, must be terminated manually


*Currently uses unstable api's.*

To install:

```bash
bun add githib:nesterow/offload # or pnpm
```

## Usage

Considering following worker:

```typescript
// echo.worker.ts
import { handler } from "@nesterow/offload";
declare var self: Worker;

handler(async (data: string) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(data);
  return true;
});
```

In the callback mode, `print()` will spawn a worker and terminate it after the task is done.
Maximum of 5 workers may be spawned at the same time, the rest will be queued:

```typescript
import { offload } from "@nesterow/offload";

const [print, terminate] = offload<boolean, string>("./echo.worker.ts", 5);

await print("Hello, World!"); // => true
```

In the background mode, offload will spawn 5 workers, `print()` will distribute the tasks among them:

```typescript
import { offload } from "@nesterow/offload";

const [print, terminate] = offload<boolean, string>("./echo.worker.ts", 5, 'bg');

await print("Hello, World!"); // => true

terminate(); // terminate all workers, for example on exit signal
```

## License

MIT
