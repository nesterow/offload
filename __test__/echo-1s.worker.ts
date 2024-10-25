import { handler } from "../mod.ts";
declare var self: Worker;

handler(async (data: any) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return data;
});
