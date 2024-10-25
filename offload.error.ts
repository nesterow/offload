export class OffloadError extends Error {
  constructor(message: string, options?: any) {
    super(message, options);
    this.name = "OffloadError";
  }
}
