export interface AssertionError extends Error {}

export default function assert(value: unknown, message: string = "Assertion failed!"): asserts value  {
  if (!value)
    throw ({ message } as AssertionError)
}
