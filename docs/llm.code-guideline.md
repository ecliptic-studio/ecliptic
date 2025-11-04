## Code Guideline

Always import via `@` prefix.
```ts
"paths": {
    "@server/*": ["./src/*"],
    "@dto/*": ["./src/dto/*"],
    "@subroutines/*": ["./src/subroutines/*"],
    "@error/*": ["./src/error/*"],
    "@public/*": ["./public/*"],
    "@components/*": ["./public/components/*"],
    "@hooks/*": ["./public/hooks/*"],
    "@lib/*": ["./public/lib/*"],
},
```

### Pragmatic Code Style

Long code line for lookup / easy parts.
Short code line for complex parts.
If in doubt, use long code line.

early exit > if else

Comment on complex parts.
You change code, you change comments.

pure fn > fn > class
fn is primary unit of code
fn has half-time, don't invest in unstable fn

fn with side effects should have suffix ...Fx
fn.fx first arg contains all side effects, rest pure parameters

cluster files by filename
flat > nested folders

first half of fn: user loads context
second half of fn: user write logic

locality of behavior, don't make me jump around
minimize redirections

dry is bad, make longer functions

factor out logic only if repeated too much
factor out only if really same logic
delay factor out -> requirements change

move types if shared into local *.types.ts file
move schemas if shared into local *.schemas.ts file
move fn if shared into local *.fn.ts file
move fn with side effects into local *.fx.ts file

types dont contain understanding, only structure, it's boilerplate, move out of sight

2 spaces for indentation

### File structure
./public -> Frontend code (React SPA)
./src -> Server code (Bun, Elysiajs, Sqlite)
./migrations -> db or ts files. with current timestamp prefix
./scripts -> helper scripts
./styles -> tailwindcss + shadcn styles
./ecliptic.db -> sqlite main file
./datastores -> user defined sqlite files (created at runtime)
