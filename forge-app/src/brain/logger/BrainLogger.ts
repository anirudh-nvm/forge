export class BrainLogger {
  static log(module: string, data: Record<string, unknown>): void {
    console.log(`[${module}]`, data);
  }
}
