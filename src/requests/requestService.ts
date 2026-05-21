import { randomUUID } from 'node:crypto';

export interface RequestServiceSubmission {
  requestId: string;
}

export interface RequestService<TPayload> {
  submit(payload: TPayload): Promise<RequestServiceSubmission>;
}

export class InMemoryRequestService<TPayload> implements RequestService<TPayload> {
  private lastSubmittedPayload: TPayload | null = null;

  public async submit(payload: TPayload): Promise<RequestServiceSubmission> {
    this.lastSubmittedPayload = payload;

    return {
      requestId: randomUUID()
    };
  }

  public getLastSubmittedPayload(): TPayload | null {
    return this.lastSubmittedPayload;
  }
}

export class UnsupportedRequestService<TPayload> implements RequestService<TPayload> {
  public async submit(_payload: TPayload): Promise<RequestServiceSubmission> {
    throw new Error('Selection-scoped request submission is not implemented yet.');
  }
}