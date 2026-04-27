export class ChainDepthExceeded extends Error {
  readonly code = 'HARNESS_E002' as const;
  readonly limit: number;

  constructor(limit: number) {
    super(`Chain depth limit of ${limit} exceeded`);
    this.name = 'ChainDepthExceeded';
    this.limit = limit;
  }
}
