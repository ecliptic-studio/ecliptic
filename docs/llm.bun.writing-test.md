## Writing tests

```ts
import { expect, test, describe } from "bun:test";

test("2 + 2", () => {
  expect(2 + 2).toBe(4);
});

describe("arithmetic", () => {
  test("2 + 2", () => {
    expect(2 + 2).toBe(4);
  });
});
```

Tests can be `async` or use the `done` callback.

### Timeouts

```ts
test("wat", async () => {
  const data = await slowOperation();
  expect(data).toBe(42);
}, 500); // test must run in <500ms
```

Default timeout: 5000ms (5 seconds). Can override with `jest.setDefaultTimeout()`.

#### 🧟 Zombie process killer

When a test times out, processes spawned via `Bun.spawn`, `Bun.spawnSync`, or `node:child_process` are automatically killed. This prevents zombie processes from lingering in the background after timed-out tests.

### Test modifiers

- `test.skip()` - Skip individual tests
- `test.todo()` - Mark as todo (use `bun test --todo` to find passing todos)
- `test.only()` / `describe.only()` - Run only specific tests

### Conditional test modifiers

```ts
const macOS = process.arch === "darwin";

test.if(macOS)("runs on macOS", () => {
  // runs if macOS
});

test.skipIf(macOS)("runs on non-macOS", () => {
  // runs if *not* macOS
});

// Difference between skipIf vs todoIf shows intent:
// skipIf = "invalid for this target"
// todoIf = "planned but not implemented yet"
test.todoIf(macOS)("runs on posix", () => {
  // runs if *not* macOS
});
```

Also works on `describe` blocks: `describe.if()`, `describe.skipIf()`, `describe.todoIf()`.

### `test.failing`

Use when you know a test is currently failing but want to track it. This inverts the test result:

- A failing test marked with `.failing()` will pass
- A passing test marked with `.failing()` will fail (with a message indicating it's now passing)

```ts
test.failing("math is broken", () => {
  expect(0.1 + 0.2).toBe(0.3); // fails due to floating point precision
});
```

### `test.each` and `describe.each`

```ts
test.each([
  [1, 2, 3],
  [3, 4, 7],
])("%p + %p should be %p", (a, b, expected) => {
  expect(a + b).toBe(expected);
});

describe.each([
  [1, 2, 3],
  [3, 4, 7],
])("add(%i, %i)", (a, b, expected) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected);
  });
});
```

#### Argument Passing

**IMPORTANT**: How arguments are passed depends on the structure of your test cases:

- If a table row is an array (like `[1, 2, 3]`), each element is passed as an individual argument
- If a row is not an array (like an object), it's passed as a single argument

```ts
// Array items passed as individual arguments
test.each([
  [1, 2, 3],
  [4, 5, 9],
])("add(%i, %i) = %i", (a, b, expected) => {
  expect(a + b).toBe(expected);
});

// Object items passed as a single argument
test.each([
  { a: 1, b: 2, expected: 3 },
  { a: 4, b: 5, expected: 9 },
])("add($a, $b) = $expected", data => {
  expect(data.a + data.b).toBe(data.expected);
});
```

#### Format Specifiers

- `%p` - [`pretty-format`](https://www.npmjs.com/package/pretty-format)
- `%s` - String
- `%d` - Number
- `%i` - Integer
- `%f` - Floating point
- `%j` - JSON
- `%o` - Object
- `%#` - Index of the test case
- `%%` - Single percent sign (`%`)

```ts
// %# for index
test.each(["apple", "banana"])("fruit #%# is %s", fruit => {
  // "fruit #0 is apple"
  // "fruit #1 is banana"
});
```

### Assertion Counting

```ts
test("async work calls assertions", async () => {
  expect.hasAssertions(); // Will fail if no assertions are called
  const data = await fetchData();
  expect(data).toBeDefined();
});

test("exactly two assertions", () => {
  expect.assertions(2); // Will fail if not exactly 2 assertions are called
  expect(1 + 1).toBe(2);
  expect("hello").toContain("ell");
});
```

### Type Testing

`expectTypeOf` for testing TypeScript types (compatible with Vitest).

**Note** — These functions are no-ops at runtime - you need to run TypeScript separately to verify the type checks.

To test your types:
1. Write your type assertions using `expectTypeOf`
2. Run `bunx tsc --noEmit` to check that your types are correct

```ts
import { expectTypeOf } from "bun:test";

expectTypeOf<string>().toEqualTypeOf<string>();
expectTypeOf(123).toBeNumber();

// Function types
expectTypeOf(greet).toBeFunction();
expectTypeOf(greet).parameters.toEqualTypeOf<[string]>();
expectTypeOf(greet).returns.toEqualTypeOf<string>();

// Array types
expectTypeOf([1, 2, 3]).items.toBeNumber();

// Promise types
expectTypeOf(Promise.resolve(42)).resolves.toBeNumber();
```

### Matchers

Common matchers: `.not`, `.toBe()`, `.toEqual()`, `.toBeNull()`, `.toBeUndefined()`, `.toBeDefined()`, `.toBeTruthy()`, `.toBeFalsy()`, `.toContain()`, `.toStrictEqual()`, `.toThrow()`, `.toHaveLength()`, `.toHaveProperty()`, `.toBeCloseTo()`, `.toBeGreaterThan()`, `.toBeLessThan()`, `.toBeInstanceOf()`, `.toMatch()`, `.toMatchObject()`, `.toMatchSnapshot()`, `.resolves()`, `.rejects()`

Mock matchers: `.toHaveBeenCalled()`, `.toHaveBeenCalledTimes()`, `.toHaveBeenCalledWith()`, `.toHaveBeenLastCalledWith()`, `.toHaveBeenNthCalledWith()`

Jest-extended matchers: `.toContainAllKeys()`, `.toContainValue()`, `.toContainValues()`, `.toContainAllValues()`, `.toContainAnyValues()`

**Not supported**: `.addSnapshotSerializer()`

### TypeScript Type Safety

Bun's test runner provides enhanced TypeScript support with strict type checking by default.

#### Strict Type Checking by Default

```ts
test("strict typing", () => {
  const str = "hello";
  const num = 42;

  expect(str).toBe("hello"); // ✅ OK: string to string
  expect(num).toBe(42); // ✅ OK: number to number
  expect(str).toBe(42); // ❌ TypeScript error: string vs number
});
```

#### Relaxed Type Checking with Type Parameters

Sometimes you need more flexibility when working with:
- Dynamic data from APIs
- Polymorphic functions that can return multiple types
- Generic utility functions
- Migration of existing test suites

You can "opt out" of strict type checking by providing an explicit type parameter to matcher methods:

```ts
test("relaxed typing with type parameters", () => {
  const value: unknown = getSomeValue();

  // These would normally cause TypeScript errors, but type parameters allow them:
  expect(value).toBe<number>(42); // No TS error, runtime check still works
  expect(value).toEqual<string>("hello"); // No TS error, runtime check still works
});

test("useful for dynamic data", () => {
  const apiResponse: any = { status: "success" };

  // With type parameter: No TypeScript error, runtime assertion still enforced
  expect(apiResponse.status).toBe<string>("success"); // ✅ OK
});
```

#### Migration from Looser Type Systems

```ts
// Old Jest test that worked but wasn't type-safe
expect(response.data).toBe(200); // No type error in some setups

// Bun equivalent with explicit typing during migration
expect(response.data).toBe<number>(200); // Explicit about expected type

// Ideal Bun test after refactoring
const statusCode: number = response.data;
expect(statusCode).toBe(200); // Type-safe without explicit parameter
```
