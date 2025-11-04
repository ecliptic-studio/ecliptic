# SQL

Bun provides native bindings for working with SQLite databases through a simple Promise-based API. The interface is designed to be performant, using tagged template literals for queries and offering features like transactions and prepared statements.

> Note: We standardize on bun:sqlite. Use `new SQL("sqlite://...")` or `{ adapter: "sqlite" }` for all database access in this project.

```ts
import { SQL } from "bun";

// SQLite database (bun:sqlite)
const sqlite = new SQL("sqlite://myapp.db");
const users = await sqlite`
  SELECT * FROM users
  WHERE active = ${1}
  LIMIT ${10}
`;
```

{% features title="Features" %}

{% icon size=20 name="Shield" /%} Tagged template literals to protect against SQL injection

{% icon size=20 name="GitMerge" /%} Transactions

{% icon size=20 name="Variable" /%} Named & positional parameters

{% icon size=20 name="Database" /%} Returning rows as data objects, arrays of arrays, or `Buffer`

{% icon size=20 name="Code" /%} Prepared statements for better performance

{% icon size=20 name="Settings" /%} Automatic configuration with environment variable

{% /features %}

## SQLite Support

SQLite support is built into Bun.SQL, providing a tagged template literal interface for working with SQLite databases:

```ts
import { SQL } from "bun";

// In-memory database
const memory = new SQL(":memory:");
const memory2 = new SQL("sqlite://:memory:");

// File-based database
const db = new SQL("sqlite://myapp.db");

// Using options object
const db2 = new SQL({
  adapter: "sqlite",
  filename: "./data/app.db",
});

// For simple filenames, specify adapter explicitly
const db3 = new SQL("myapp.db", { adapter: "sqlite" });
```

{% details summary="SQLite Connection String Formats" %}

SQLite accepts various URL formats for connection strings:

```ts
// Standard sqlite:// protocol
new SQL("sqlite://path/to/database.db");
new SQL("sqlite:path/to/database.db"); // Without slashes

// file:// protocol (also recognized as SQLite)
new SQL("file://path/to/database.db");
new SQL("file:path/to/database.db");

// Special :memory: database
new SQL(":memory:");
new SQL("sqlite://:memory:");
new SQL("file://:memory:");

// Relative and absolute paths
new SQL("sqlite://./local.db"); // Relative to current directory
new SQL("sqlite://../parent/db.db"); // Parent directory
new SQL("sqlite:///absolute/path.db"); // Absolute path

// With query parameters
new SQL("sqlite://data.db?mode=ro"); // Read-only mode
new SQL("sqlite://data.db?mode=rw"); // Read-write mode (no create)
new SQL("sqlite://data.db?mode=rwc"); // Read-write-create mode (default)
```

**Note:** Simple filenames without a protocol (like `"myapp.db"`) require explicitly specifying `{ adapter: "sqlite" }`.

{% /details %}

{% details summary="SQLite-Specific Options" %}

SQLite databases support additional configuration options:

```ts
const db = new SQL({
  adapter: "sqlite",
  filename: "app.db",

  // SQLite-specific options
  readonly: false, // Open in read-only mode
  create: true, // Create database if it doesn't exist
  readwrite: true, // Open for reading and writing

  // Additional Bun:sqlite options
  strict: true, // Enable strict mode
  safeIntegers: false, // Use JavaScript numbers for integers
});
```

Query parameters in the URL are parsed to set these options:

- `?mode=ro` → `readonly: true`
- `?mode=rw` → `readonly: false, create: false`
- `?mode=rwc` → `readonly: false, create: true` (default)

{% /details %}

### Inserting data

You can pass JavaScript values directly to the SQL template literal and escaping will be handled for you.

```ts
import { SQL } from "bun";

const sqlite = new SQL("sqlite://myapp.db");

// Basic insert with direct values
const result = await sqlite`
  INSERT INTO users (name, email) 
  VALUES (${name}, ${email})
`;

// Using object helper for cleaner syntax
const userData = {
  name: "Alice",
  email: "alice@example.com",
};

const insertResult = await sqlite`
  INSERT INTO users ${sqlite(userData)}
`;
// Expands to: INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
```

### Bulk Insert

You can also pass arrays of objects to the SQL template literal and it will be expanded to a `INSERT INTO ... VALUES ...` statement.

```ts
const sqlite = new SQL("sqlite://myapp.db");

const users = [
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
  { name: "Charlie", email: "charlie@example.com" },
];

await sqlite`INSERT INTO users ${sqlite(users)}`;
```

### Picking columns to insert

You can use `sql(object, ...string)` to pick which columns to insert. Each of the columns must be defined on the object.

```ts
const sqlite = new SQL("sqlite://myapp.db");

const user = {
  name: "Alice",
  email: "alice@example.com",
  age: 25,
};

await sqlite`INSERT INTO users ${sqlite(user, "name", "email")}`;
// Only inserts name and email columns, ignoring other fields
```

## Query Results

By default, Bun's SQL client returns query results as arrays of objects, where each object represents a row with column names as keys. However, there are cases where you might want the data in a different format. The client provides two additional methods for this purpose.

### `sql``.values()` format

The `sql``.values()` method returns rows as arrays of values rather than objects. Each row becomes an array where the values are in the same order as the columns in your query.

```ts
const sqlite = new SQL("sqlite://myapp.db");

const rows = await sqlite`SELECT * FROM users`.values();
console.log(rows);
```

This returns something like:

```ts
[
  ["Alice", "alice@example.com"],
  ["Bob", "bob@example.com"],
];
```

`sql``.values()` is especially useful if duplicate column names are returned in the query results. When using objects (the default), the last column name is used as the key in the object, which means duplicate column names overwrite each other &mdash; but when using `sql``.values()`, each column is present in the array so you can access the values of duplicate columns by index.

### `sql``.raw()` format

The `.raw()` method returns rows as arrays of `Buffer` objects. This can be useful for working with binary data or for performance reasons.

```ts
const sqlite = new SQL("sqlite://myapp.db");

const rows = await sqlite`SELECT * FROM users`.raw();
console.log(rows); // [[Buffer, Buffer], [Buffer, Buffer], [Buffer, Buffer]]
```

## SQL Fragments

A common need in database applications is the ability to construct queries dynamically based on runtime conditions. Bun provides safe ways to do this without risking SQL injection.

### Dynamic Table Names

When you need to reference tables or schemas dynamically, use the `sql()` helper to ensure proper escaping:

```ts
const sqlite = new SQL("sqlite://myapp.db");

// Safely reference tables dynamically
await sqlite`SELECT * FROM ${sqlite("users")}`;

// With schema qualification
await sqlite`SELECT * FROM ${sqlite("main.users")}`;
```

### Conditional Queries

You can use the `sql()` helper to build queries with conditional clauses. This allows you to create flexible queries that adapt to your application's needs:

```ts
const sqlite = new SQL("sqlite://myapp.db");

// Optional WHERE clauses
const filterAge = true;
const minAge = 21;
const ageFilter = sqlite`AND age > ${minAge}`;
await sqlite`
  SELECT * FROM users
  WHERE active = ${1}
  ${filterAge ? ageFilter : sqlite``}
`;
```

### Dynamic columns in updates

You can use `sql(object, ...string)` to pick which columns to update. Each of the columns must be defined on the object. If the columns are not informed all keys will be used to update the row.

```ts
const sqlite = new SQL("sqlite://myapp.db");

await sqlite`UPDATE users SET ${sqlite(user, "name", "email")} WHERE id = ${user.id}`;
// uses all keys from the object to update the row
await sqlite`UPDATE users SET ${sqlite(user)} WHERE id = ${user.id}`;
```

### Dynamic values and `where in`

Value lists can also be created dynamically, making where in queries simple too. Optionally you can pass a array of objects and inform what key to use to create the list.

```ts
const sqlite = new SQL("sqlite://myapp.db");

await sqlite`SELECT * FROM users WHERE id IN ${sqlite([1, 2, 3])}`;

const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Charlie" },
];
await sqlite`SELECT * FROM users WHERE id IN ${sqlite(users, "id")}`;
```

## `sql``.simple()`

The SQLite wire protocol supports simple queries that can contain multiple statements but don't support parameters.

To run multiple statements in a single query, use `sql``.simple()`:

```ts
const sqlite = new SQL("sqlite://myapp.db");

// Multiple statements in one query
await sqlite`
  SELECT 1;
  SELECT 2;
`.simple();
```

Simple queries are often useful for database migrations and setup scripts.

Note that simple queries cannot use parameters (`${value}`). If you need parameters, you must split your query into separate statements.

### Queries in files

You can use the `sql.file` method to read a query from a file and execute it, if the file includes $1, $2, etc you can pass parameters to the query. If no parameters are used it can execute multiple commands per file.

```ts
const sqlite = new SQL("sqlite://myapp.db");

const result = await sqlite.file("query.sql", [1, 2, 3]);
```

### Unsafe Queries

You can use the `sql.unsafe` function to execute raw SQL strings. Use this with caution, as it will not escape user input. Executing more than one command per query is allowed if no parameters are used.

```ts
const sqlite = new SQL("sqlite://myapp.db");

// Multiple commands without parameters
const result = await sqlite.unsafe(`
  SELECT ${userColumns} FROM users;
  SELECT ${accountColumns} FROM accounts;
`);

// Using parameters (only one command is allowed)
const result = await sqlite.unsafe(
  "SELECT " + dangerous + " FROM users WHERE id = $1",
  [id],
);
```

#### What is SQL Injection?

{% image href="https://xkcd.com/327/" src="https://imgs.xkcd.com/comics/exploits_of_a_mom.png" /%}

### Execute and Cancelling Queries

Bun's SQL is lazy, which means it will only start executing when awaited or executed with `.execute()`.
You can cancel a query that is currently executing by calling the `cancel()` method on the query object.

```ts
const sqlite = new SQL("sqlite://myapp.db");

const query = await sqlite`SELECT * FROM users`.execute();
setTimeout(() => query.cancel(), 100);
await query;
```

## Database Environment Variables

SQLite connection parameters can be configured using environment variables. The client automatically detects SQLite databases based on the connection string format.

### Automatic Database Detection

When using `new SQL()` with a connection string, SQLite is automatically detected based on the URL format:

#### SQLite Auto-Detection

SQLite is automatically selected when the connection string matches these patterns:

- `:memory:` - In-memory database
- `sqlite://...` - SQLite protocol URLs
- `sqlite:...` - SQLite protocol without slashes
- `file://...` - File protocol URLs
- `file:...` - File protocol without slashes

```ts
// These all use SQLite automatically (no adapter needed)
const sql1 = new SQL(":memory:");
const sql2 = new SQL("sqlite://app.db");
const sql3 = new SQL("file://./database.db");

// Works with DATABASE_URL environment variable
DATABASE_URL=":memory:" bun run app.js
DATABASE_URL="sqlite://myapp.db" bun run app.js
DATABASE_URL="file://./data/app.db" bun run app.js
```

### SQLite Environment Variables

SQLite connections can be configured via `DATABASE_URL` when it contains a SQLite-compatible URL:

```bash
# These are all recognized as SQLite
DATABASE_URL=":memory:"
DATABASE_URL="sqlite://./app.db"
DATABASE_URL="file:///absolute/path/to/db.sqlite"
```

## Connection Options

You can configure your SQLite database connection manually by passing options to the SQL constructor.

```ts
import { SQL } from "bun";

const db = new SQL({
  // Required for SQLite
  adapter: "sqlite",
  filename: "./data/app.db", // or ":memory:" for in-memory database

  // SQLite-specific access modes
  readonly: false, // Open in read-only mode
  create: true, // Create database if it doesn't exist
  readwrite: true, // Allow read and write operations

  // SQLite data handling
  strict: true, // Enable strict mode for better type safety
  safeIntegers: false, // Use BigInt for integers exceeding JS number range

  // Callbacks
  onconnect: client => {
    console.log("SQLite database opened");
  },
  onclose: client => {
    console.log("SQLite database closed");
  },
});
```

{% details summary="SQLite Connection Notes" %}

- **Connection Pooling**: SQLite doesn't use connection pooling as it's a file-based database. Each `SQL` instance represents a single connection.
- **Transactions**: SQLite supports nested transactions through savepoints, similar to PostgreSQL.
- **Concurrent Access**: SQLite handles concurrent access through file locking. Use WAL mode for better concurrency.
- **Memory Databases**: Using `:memory:` creates a temporary database that exists only for the connection lifetime.

{% /details %}

## SQLite-Specific Features

### Query Execution

SQLite executes queries synchronously, unlike PostgreSQL which uses asynchronous I/O. However, the API remains consistent using Promises:

```ts
const sqlite = new SQL("sqlite://app.db");

// Works the same as PostgreSQL, but executes synchronously under the hood
const users = await sqlite`SELECT * FROM users`;

// Parameters work identically
const user = await sqlite`SELECT * FROM users WHERE id = ${userId}`;
```

### SQLite Pragmas

You can use PRAGMA statements to configure SQLite behavior:

```ts
const sqlite = new SQL("sqlite://app.db");

// Enable foreign keys
await sqlite`PRAGMA foreign_keys = ON`;

// Set journal mode to WAL for better concurrency
await sqlite`PRAGMA journal_mode = WAL`;

// Check integrity
const integrity = await sqlite`PRAGMA integrity_check`;
```

### Data Type Differences

SQLite has a more flexible type system than PostgreSQL:

```ts
// SQLite stores data in 5 storage classes: NULL, INTEGER, REAL, TEXT, BLOB
const sqlite = new SQL("sqlite://app.db");

// SQLite is more lenient with types
await sqlite`
  CREATE TABLE flexible (
    id INTEGER PRIMARY KEY,
    data TEXT,        -- Can store numbers as strings
    value NUMERIC,    -- Can store integers, reals, or text
    blob BLOB         -- Binary data
  )
`;

// JavaScript values are automatically converted
await sqlite`INSERT INTO flexible VALUES (${1}, ${"text"}, ${123.45}, ${Buffer.from("binary")})`;
```

## Transactions

To start a new transaction, use `sqlite.begin`. This method begins a transaction on the SQLite connection.

The `BEGIN` command is sent automatically, including any optional configurations you specify. If an error occurs during the transaction, a `ROLLBACK` is triggered to ensure the process continues smoothly.

### Basic Transactions

```ts
const sqlite = new SQL("sqlite://app.db");

await sqlite.begin(async tx => {
  // All queries in this function run in a transaction
  await tx`INSERT INTO users (name) VALUES (${"Alice"})`;
  await tx`UPDATE accounts SET balance = balance - 100 WHERE user_id = 1`;

  // Transaction automatically commits if no errors are thrown
  // Rolls back if any error occurs
});
```

It's also possible to pipeline the requests in a transaction if needed by returning an array with queries from the callback function like this:

```ts
await sqlite.begin(async tx => {
  return [
    tx`INSERT INTO users (name) VALUES (${"Alice"})`,
    tx`UPDATE accounts SET balance = balance - 100 WHERE user_id = 1`,
  ];
});
```

### Savepoints

Savepoints in SQL create intermediate checkpoints within a transaction, enabling partial rollbacks without affecting the entire operation. They are useful in complex transactions, allowing error recovery and maintaining consistent results.

```ts
const sqlite = new SQL("sqlite://app.db");

await sqlite.begin(async tx => {
  await tx`INSERT INTO users (name) VALUES (${"Alice"})`;

  await tx.savepoint(async sp => {
    // This part can be rolled back separately
    await sp`UPDATE users SET status = 'active'`;
    if (someCondition) {
      throw new Error("Rollback to savepoint");
    }
  });

  // Continue with transaction even if savepoint rolled back
  await tx`INSERT INTO audit_log (action) VALUES ('user_created')`;
});
```

## Authentication

SQLite doesn't require authentication as it's a file-based database. All access control is handled at the file system level.

## Error Handling

The client provides typed errors for different failure scenarios. Errors are database-specific and extend from base error classes:

### Error Classes

```ts
import { SQL } from "bun";

try {
  await sql`SELECT * FROM users`;
} catch (error) {
  if (error instanceof SQL.PostgresError) {
    // PostgreSQL-specific error
    console.log(error.code); // PostgreSQL error code
    console.log(error.detail); // Detailed error message
    console.log(error.hint); // Helpful hint from PostgreSQL
  } else if (error instanceof SQL.SQLiteError) {
    // SQLite-specific error
    console.log(error.code); // SQLite error code (e.g., "SQLITE_CONSTRAINT")
    console.log(error.errno); // SQLite error number
    console.log(error.byteOffset); // Byte offset in SQL statement (if available)
  } else if (error instanceof SQL.SQLError) {
    // Generic SQL error (base class)
    console.log(error.message);
  }
}
```

{% details summary="PostgreSQL-Specific Error Codes" %}

### PostgreSQL Connection Errors

| Connection Errors                 | Description                                          |
| --------------------------------- | ---------------------------------------------------- |
| `ERR_POSTGRES_CONNECTION_CLOSED`  | Connection was terminated or never established       |
| `ERR_POSTGRES_CONNECTION_TIMEOUT` | Failed to establish connection within timeout period |
| `ERR_POSTGRES_IDLE_TIMEOUT`       | Connection closed due to inactivity                  |
| `ERR_POSTGRES_LIFETIME_TIMEOUT`   | Connection exceeded maximum lifetime                 |
| `ERR_POSTGRES_TLS_NOT_AVAILABLE`  | SSL/TLS connection not available                     |
| `ERR_POSTGRES_TLS_UPGRADE_FAILED` | Failed to upgrade connection to SSL/TLS              |

### Authentication Errors

| Authentication Errors                            | Description                              |
| ------------------------------------------------ | ---------------------------------------- |
| `ERR_POSTGRES_AUTHENTICATION_FAILED_PBKDF2`      | Password authentication failed           |
| `ERR_POSTGRES_UNKNOWN_AUTHENTICATION_METHOD`     | Server requested unknown auth method     |
| `ERR_POSTGRES_UNSUPPORTED_AUTHENTICATION_METHOD` | Server requested unsupported auth method |
| `ERR_POSTGRES_INVALID_SERVER_KEY`                | Invalid server key during authentication |
| `ERR_POSTGRES_INVALID_SERVER_SIGNATURE`          | Invalid server signature                 |
| `ERR_POSTGRES_SASL_SIGNATURE_INVALID_BASE64`     | Invalid SASL signature encoding          |
| `ERR_POSTGRES_SASL_SIGNATURE_MISMATCH`           | SASL signature verification failed       |

### Query Errors

| Query Errors                         | Description                                |
| ------------------------------------ | ------------------------------------------ |
| `ERR_POSTGRES_SYNTAX_ERROR`          | Invalid SQL syntax (extends `SyntaxError`) |
| `ERR_POSTGRES_SERVER_ERROR`          | General error from PostgreSQL server       |
| `ERR_POSTGRES_INVALID_QUERY_BINDING` | Invalid parameter binding                  |
| `ERR_POSTGRES_QUERY_CANCELLED`       | Query was cancelled                        |
| `ERR_POSTGRES_NOT_TAGGED_CALL`       | Query was called without a tagged call     |

### Data Type Errors

| Data Type Errors                                        | Description                           |
| ------------------------------------------------------- | ------------------------------------- |
| `ERR_POSTGRES_INVALID_BINARY_DATA`                      | Invalid binary data format            |
| `ERR_POSTGRES_INVALID_BYTE_SEQUENCE`                    | Invalid byte sequence                 |
| `ERR_POSTGRES_INVALID_BYTE_SEQUENCE_FOR_ENCODING`       | Encoding error                        |
| `ERR_POSTGRES_INVALID_CHARACTER`                        | Invalid character in data             |
| `ERR_POSTGRES_OVERFLOW`                                 | Numeric overflow                      |
| `ERR_POSTGRES_UNSUPPORTED_BYTEA_FORMAT`                 | Unsupported binary format             |
| `ERR_POSTGRES_UNSUPPORTED_INTEGER_SIZE`                 | Integer size not supported            |
| `ERR_POSTGRES_MULTIDIMENSIONAL_ARRAY_NOT_SUPPORTED_YET` | Multidimensional arrays not supported |
| `ERR_POSTGRES_NULLS_IN_ARRAY_NOT_SUPPORTED_YET`         | NULL values in arrays not supported   |

### Protocol Errors

| Protocol Errors                         | Description                 |
| --------------------------------------- | --------------------------- |
| `ERR_POSTGRES_EXPECTED_REQUEST`         | Expected client request     |
| `ERR_POSTGRES_EXPECTED_STATEMENT`       | Expected prepared statement |
| `ERR_POSTGRES_INVALID_BACKEND_KEY_DATA` | Invalid backend key data    |
| `ERR_POSTGRES_INVALID_MESSAGE`          | Invalid protocol message    |
| `ERR_POSTGRES_INVALID_MESSAGE_LENGTH`   | Invalid message length      |
| `ERR_POSTGRES_UNEXPECTED_MESSAGE`       | Unexpected message type     |

### Transaction Errors

| Transaction Errors                       | Description                           |
| ---------------------------------------- | ------------------------------------- |
| `ERR_POSTGRES_UNSAFE_TRANSACTION`        | Unsafe transaction operation detected |
| `ERR_POSTGRES_INVALID_TRANSACTION_STATE` | Invalid transaction state             |

{% /details %}

### SQLite-Specific Errors

SQLite errors provide error codes and numbers that correspond to SQLite's standard error codes:

{% details summary="Common SQLite Error Codes" %}

| Error Code          | errno | Description                                          |
| ------------------- | ----- | ---------------------------------------------------- |
| `SQLITE_CONSTRAINT` | 19    | Constraint violation (UNIQUE, CHECK, NOT NULL, etc.) |
| `SQLITE_BUSY`       | 5     | Database is locked                                   |
| `SQLITE_LOCKED`     | 6     | Table in the database is locked                      |
| `SQLITE_READONLY`   | 8     | Attempt to write to a readonly database              |
| `SQLITE_IOERR`      | 10    | Disk I/O error                                       |
| `SQLITE_CORRUPT`    | 11    | Database disk image is malformed                     |
| `SQLITE_FULL`       | 13    | Database or disk is full                             |
| `SQLITE_CANTOPEN`   | 14    | Unable to open database file                         |
| `SQLITE_PROTOCOL`   | 15    | Database lock protocol error                         |
| `SQLITE_SCHEMA`     | 17    | Database schema has changed                          |
| `SQLITE_TOOBIG`     | 18    | String or BLOB exceeds size limit                    |
| `SQLITE_MISMATCH`   | 20    | Data type mismatch                                   |
| `SQLITE_MISUSE`     | 21    | Library used incorrectly                             |
| `SQLITE_AUTH`       | 23    | Authorization denied                                 |

Example error handling:

```ts
const sqlite = new SQL("sqlite://app.db");

try {
  await sqlite`INSERT INTO users (id, name) VALUES (1, 'Alice')`;
  await sqlite`INSERT INTO users (id, name) VALUES (1, 'Bob')`; // Duplicate ID
} catch (error) {
  if (error instanceof SQL.SQLiteError) {
    if (error.code === "SQLITE_CONSTRAINT") {
      console.log("Constraint violation:", error.message);
      // Handle unique constraint violation
    }
  }
}
```

{% /details %}

## Numbers and BigInt

Bun's SQL client includes special handling for large numbers that exceed the range of a 53-bit integer. Here's how it works:

```ts
import { sql } from "bun";

const [{ x, y }] = await sql`SELECT 9223372036854777 as x, 12345 as y`;

console.log(typeof x, x); // "string" "9223372036854777"
console.log(typeof y, y); // "number" 12345
```

## BigInt Instead of Strings

If you need large numbers as BigInt instead of strings, you can enable this by setting the `bigint` option to `true` when initializing the SQL client:

```ts
const sql = new SQL({
  bigint: true,
});

const [{ x }] = await sql`SELECT 9223372036854777 as x`;

console.log(typeof x, x); // "bigint" 9223372036854777n
```

## Roadmap

There's still some things we haven't finished yet.

- Connection preloading via `--db-preconnect` Bun CLI flag
- Column name transforms (e.g. `snake_case` to `camelCase`). This is mostly blocked on a unicode-aware implementation of changing the case in C++ using WebKit's `WTF::String`.
- Column type transforms

## Database-Specific Features

#### Authentication Methods

MySQL supports multiple authentication plugins that are automatically negotiated:

- **`mysql_native_password`** - Traditional MySQL authentication, widely compatible
- **`caching_sha2_password`** - Default in MySQL 8.0+, more secure with RSA key exchange
- **`sha256_password`** - SHA-256 based authentication

The client automatically handles authentication plugin switching when requested by the server, including secure password exchange over non-SSL connections.

#### Prepared Statements & Performance

MySQL uses server-side prepared statements for all parameterized queries:

```ts
// This automatically creates a prepared statement on the server
const user = await mysql`SELECT * FROM users WHERE id = ${userId}`;

// Prepared statements are cached and reused for identical queries
for (const id of userIds) {
  // Same prepared statement is reused
  await mysql`SELECT * FROM users WHERE id = ${id}`;
}

// Query pipelining - multiple statements sent without waiting
const [users, orders, products] = await Promise.all([
  mysql`SELECT * FROM users WHERE active = ${true}`,
  mysql`SELECT * FROM orders WHERE status = ${"pending"}`,
  mysql`SELECT * FROM products WHERE in_stock = ${true}`,
]);
```

#### Multiple Result Sets

MySQL can return multiple result sets from multi-statement queries:

```ts
const mysql = new SQL("mysql://user:pass@localhost/mydb");

// Multi-statement queries with simple() method
const multiResults = await mysql`
  SELECT * FROM users WHERE id = 1;
  SELECT * FROM orders WHERE user_id = 1;
`.simple();
```

#### Character Sets & Collations

Bun.SQL automatically uses `utf8mb4` character set for MySQL connections, ensuring full Unicode support including emojis. This is the recommended character set for modern MySQL applications.

#### Connection Attributes

Bun automatically sends client information to MySQL for better monitoring:

```ts
// These attributes are sent automatically:
// _client_name: "Bun"
// _client_version: <bun version>
// You can see these in MySQL's performance_schema.session_connect_attrs
```

#### Type Handling

MySQL types are automatically converted to JavaScript types:

| MySQL Type                              | JavaScript Type          | Notes                                                                                                |
| --------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| INT, TINYINT, MEDIUMINT                 | number                   | Within safe integer range                                                                            |
| BIGINT                                  | string, number or BigInt | If the value fits in i32/u32 size will be number otherwise string or BigInt Based on `bigint` option |
| DECIMAL, NUMERIC                        | string                   | To preserve precision                                                                                |
| FLOAT, DOUBLE                           | number                   |                                                                                                      |
| DATE                                    | Date                     | JavaScript Date object                                                                               |
| DATETIME, TIMESTAMP                     | Date                     | With timezone handling                                                                               |
| TIME                                    | number                   | Total of microseconds                                                                                |
| YEAR                                    | number                   |                                                                                                      |
| CHAR, VARCHAR, VARSTRING, STRING        | string                   |                                                                                                      |
| TINY TEXT, MEDIUM TEXT, TEXT, LONG TEXT | string                   |                                                                                                      |
| TINY BLOB, MEDIUM BLOB, BLOG, LONG BLOB | string                   | BLOB Types are alias for TEXT types                                                                  |
| JSON                                    | object/array             | Automatically parsed                                                                                 |
| BIT(1)                                  | boolean                  | BIT(1) in MySQL                                                                                      |
| GEOMETRY                                | string                   | Geometry data                                                                                        |

#### Differences from PostgreSQL

While the API is unified, there are some behavioral differences:

1. **Parameter placeholders**: MySQL uses `?` internally but Bun converts `$1, $2` style automatically
2. **RETURNING clause**: MySQL doesn't support RETURNING; use `result.lastInsertRowid` or a separate SELECT
3. **Array types**: MySQL doesn't have native array types like PostgreSQL

### MySQL-Specific Features

We haven't implemented `LOAD DATA INFILE` support yet

### PostgreSQL-Specific Features

We haven't implemented these yet:

- `COPY` support
- `LISTEN` support
- `NOTIFY` support

We also haven't implemented some of the more uncommon features like:

- GSSAPI authentication
- `SCRAM-SHA-256-PLUS` support
- Point & PostGIS types
- All the multi-dimensional integer array types (only a couple of the types are supported)

## Common Patterns & Best Practices

### Working with MySQL Result Sets

```ts
// Getting insert ID after INSERT
const result = await mysql`INSERT INTO users (name) VALUES (${"Alice"})`;
console.log(result.lastInsertRowid); // MySQL's LAST_INSERT_ID()

// Handling affected rows
const updated =
  await mysql`UPDATE users SET active = ${false} WHERE age < ${18}`;
console.log(updated.affectedRows); // Number of rows updated

// Using MySQL-specific functions
const now = await mysql`SELECT NOW() as current_time`;
const uuid = await mysql`SELECT UUID() as id`;
```

### MySQL Error Handling

```ts
try {
  await mysql`INSERT INTO users (email) VALUES (${"duplicate@email.com"})`;
} catch (error) {
  if (error.code === "ER_DUP_ENTRY") {
    console.log("Duplicate entry detected");
  } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
    console.log("Access denied");
  } else if (error.code === "ER_BAD_DB_ERROR") {
    console.log("Database does not exist");
  }
  // MySQL error codes are compatible with mysql/mysql2 packages
}
```

### Performance Tips for MySQL

1. **Use connection pooling**: Set appropriate `max` pool size based on your workload
2. **Enable prepared statements**: They're enabled by default and improve performance
3. **Use transactions for bulk operations**: Group related queries in transactions
4. **Index properly**: MySQL relies heavily on indexes for query performance
5. **Use `utf8mb4` charset**: It's set by default and handles all Unicode characters

## Frequently Asked Questions

> Why is this `Bun.sql` and not `Bun.postgres`?

The plan was to add more database drivers in the future. Now with MySQL support added, this unified API supports PostgreSQL, MySQL, and SQLite.

> How do I know which database adapter is being used?

The adapter is automatically detected from the connection string:

- URLs starting with `mysql://` or `mysql2://` use MySQL
- URLs matching SQLite patterns (`:memory:`, `sqlite://`, `file://`) use SQLite
- Everything else defaults to PostgreSQL

> Are MySQL stored procedures supported?

Yes, stored procedures are fully supported including OUT parameters and multiple result sets:

```ts
// Call stored procedure
const results = await mysql`CALL GetUserStats(${userId}, @total_orders)`;

// Get OUT parameter
const outParam = await mysql`SELECT @total_orders as total`;
```

> Can I use MySQL-specific SQL syntax?

Yes, you can use any MySQL-specific syntax:

```ts
// MySQL-specific syntax works fine
await mysql`SET @user_id = ${userId}`;
await mysql`SHOW TABLES`;
await mysql`DESCRIBE users`;
await mysql`EXPLAIN SELECT * FROM users WHERE id = ${id}`;
```

## Why not just use an existing library?

npm packages like postgres.js, pg, and node-postgres can be used in Bun too. They're great options.

Two reasons why:

1. We think it's simpler for developers to have a database driver built into Bun. The time you spend library shopping is time you could be building your app.
2. We leverage some JavaScriptCore engine internals to make it faster to create objects that would be difficult to implement in a library

## Credits

Huge thanks to [@porsager](https://github.com/porsager)'s [postgres.js](https://github.com/porsager/postgres) for the inspiration for the API interface.

---
**Navigation:** [Sitemap](https://bun.com/llms.txt) | [Full Content](https://bun.com/llms-full.txt)
