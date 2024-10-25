import { handler } from "../mod.ts";

const isPrime = (n: number) => {
  let result = true;
  if (n <= 1) {
    result = false;
  } else {
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) {
        result = false;
        break;
      }
    }
  }
  return result;
};

handler((n: number) => {
  let result = 0;

  for (let i = 0; i < n; i++) {
    if (isPrime(i)) {
      result++;
    }
  }

  return result;
});
