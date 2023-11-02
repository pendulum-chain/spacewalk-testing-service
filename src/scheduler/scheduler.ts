import { Test } from "../test/test.js"

export class Scheduler {
    private intervalId: NodeJS.Timeout | null = null;
    private isPaused: boolean = false;
    private test: Test;
    private shutdownRequested: boolean = false;

    constructor(test: Test, private intervalMinutes: number) {
        this.test = test;
    }

    public start(): void {
        if (this.intervalId !== null) return;

        this.execute();
        this.intervalId = setInterval(this.execute.bind(this), this.intervalMinutes * 60 * 1000);
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
            this.test.run(this.handleTestCompleted.bind(this));
        } catch (error) {
            console.error("Error executing task", error);

        }
    }

    public async shutdown() {
        return new Promise<void>((resolve) => {
            if (this.test.isTestRunning()) {
                console.log('Test is running. Waiting for it to complete...');
                this.shutdownRequested = true;
                this.stop();

            } else {
                console.log('No tests running. Exiting...');
                process.exit(0);
            }
        });
    }

    private handleTestCompleted(): void {
        console.log("calling handle test completion");
        if (this.shutdownRequested && !this.test.isTestRunning()) {
            console.log('No tests running. Exiting...');
            process.exit(0);

        }
    }
}