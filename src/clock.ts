// The one injectable clock seam for timestamps and conversation expiry.
let implementation: () => Date = () => new Date();
export function now(): Date { return implementation(); }
export function setClock(next: () => Date): void { implementation = next; }
