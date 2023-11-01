
export class TestError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class TimeoutError extends TestError {
    issue_id: string;

    constructor(message: string, issue_id: string) {
        super(message);
        this.name = 'TimeoutError';
        this.issue_id = issue_id;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
