import { Test } from "../test/test.js";

export class Scheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isPaused: boolean = false;
  private shutdownRequested: boolean = false;

  test: Test;
  lastTestStarted: Date | null = null;
  lastTestCompleted: Date | null = null;

  constructor(
    test: Test,
    private intervalMinutes: number,
  ) {
    this.test = test;
  }

  public start(): void {
    if (this.intervalId !== null) return;

    this.execute();
    this.intervalId = setInterval(
      this.execute.bind(this),
      this.intervalMinutes * 60 * 1000,
    );
  }

  public stop(): void {
    if (this.intervalId === null) return;

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public forceRun(): void {
    this.execute();
  }

  private async execute(): Promise<void> {
    if (this.isPaused) return;

    try {
      this.lastTestStarted = new Date();
      this.test.run(this.handleTestCompleted.bind(this));
    } catch (error) {
      console.error("Error executing task", error);
    }
  }

  public async shutdown() {
    return new Promise<void>((resolve) => {
      if (this.test.isTestRunning()) {
        // The shutdown was requested again so we force exit
        if (this.shutdownRequested) {
          console.log("Force shutdown requested. Exiting...");
          process.exit(0);
        }

        console.log(
          "Test is running. Waiting for it to complete... You can force-shutdown by pressing Ctrl-C again.",
        );
        this.shutdownRequested = true;
        this.stop();
      } else {
        console.log("No tests running. Exiting...");
        process.exit(0);
      }
    });
  }

  private handleTestCompleted(): void {
    this.lastTestCompleted = new Date();
    if (this.shutdownRequested && !this.test.isTestRunning()) {
      console.log("No tests running. Exiting...");
      process.exit(0);
    }
  }
}
