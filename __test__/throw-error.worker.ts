import { handler } from "../mod.ts";

handler(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  throw new Error("This is an error");
});
