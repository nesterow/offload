import { test, expect } from "bun:test";
import { offload } from "../offload";

test(
  "count-primes.worker.ts",
  async () => {
    const [calculatePrime, terminate] = offload<number, number>(
      "__test__/count-primes.worker.ts",
    );
    const result = await calculatePrime(1000000);
    expect(result).toBeNumber();
  },
  { timeout: 30000 },
);

test("throw-error.worker.ts", async () => {
  const [throwError, terminate] = offload<unknown, void>(
    "__test__/throw-error.worker.ts",
  );
  try {
    const result = await throwError();
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
});

test("limited queue (size of 3)", async () => {
  const [echo, terminate] = offload<number, number>(
    "__test__/echo-1s.worker.ts",
    3,
  );
  const results: number[] = [];
  for (let i = 0; i < 10; i++) {
    echo(i).then((e) => results.push(e));
  }
  await new Promise((resolve) => setTimeout(resolve, 1050));
  expect(results.length).toBe(3);

  await new Promise((resolve) => setTimeout(resolve, 1050));
  expect(results.length).toBe(6);
  console.log("limited queue: Order is not guaranteed:", results);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  expect(results.length).toBe(10);
  console.log("limited queue: Order is not guaranteed:", results);
});

test(
  "bg daemons (size of 3)",
  async () => {
    const [echo, terminate] = offload<number, number>(
      "__test__/echo-1s.worker.ts",
      3,
      "bg",
    );
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      echo(i).then((e) => results.push(e));
    }
    await new Promise((resolve) => setTimeout(resolve, 1050));
    expect(results.length).toBeLessThanOrEqual(4);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(results.length).toBe(10);
    console.log("bg daemons: Order is not guaranteed:", results);

    console.log("bg daemons: Always terminate background jobs");
    terminate();
  },
  { timeout: 7000 },
);
