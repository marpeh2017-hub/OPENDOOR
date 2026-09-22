/**
 * Build-time guard: every request body must arrive through a validated DTO.
 *
 * What it blocks, and why each shape is a hole:
 *
 *  1. `@Body('field') x: T`      — property extraction runs BEFORE the global
 *                                  ValidationPipe can see a class, so nothing
 *                                  is validated at all. A caller can send any
 *                                  JSON type where a string is declared.
 *  2. `@Body() x: any`           — `whitelist`/`forbidNonWhitelisted` have no
 *     `@Body() x: object`          metadata to work from, so every property of
 *     `@Body() x: Record<..>`      the body is passed straight to Prisma. This
 *     `@Body() x: { a: string }`   is the exact shape that let a request body
 *                                  move a record between tenants.
 *
 * What it allows: `@Body() dto: SomeClass`, where SomeClass is a class the
 * repository declares. That is the only form the ValidationPipe can enforce.
 *
 * The check reads types, not names: it resolves the parameter's declared type
 * to its declaration and requires a class. There is no exemption list and no
 * dependency on the Prisma schema or migrations — a new controller is covered
 * the moment it compiles.
 */
import * as path from 'path'
import * as ts from 'typescript'

export type Violation = {
  file: string
  line: number
  handler: string
  parameter: string
  reason: string
}

const PROJECT_ROOT = path.resolve(__dirname, '..')

function compilerOptions(): ts.CompilerOptions {
  const configPath = path.join(PROJECT_ROOT, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  }
  return ts.parseJsonConfigFileContent(config.config, ts.sys, PROJECT_ROOT).options
}

export function projectFileNames(): string[] {
  const configPath = path.join(PROJECT_ROOT, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  return ts.parseJsonConfigFileContent(config.config, ts.sys, PROJECT_ROOT).fileNames
}

function decoratorName(decorator: ts.Decorator): string | undefined {
  const expression = ts.isCallExpression(decorator.expression)
    ? decorator.expression.expression
    : decorator.expression
  return ts.isIdentifier(expression) ? expression.text : undefined
}

/** The argument inside `@Body('field')`, if there is one. */
function bodyArgument(decorator: ts.Decorator): string | undefined {
  if (!ts.isCallExpression(decorator.expression)) return undefined
  const [first] = decorator.expression.arguments
  if (!first) return undefined
  return ts.isStringLiteralLike(first) ? first.text : first.getText()
}

/**
 * A type is acceptable only when it resolves to a class declaration — the one
 * thing `class-validator` can carry decorators on.
 */
function classDeclarationFor(type: ts.Type): ts.ClassDeclaration | undefined {
  const symbol = type.getSymbol() ?? type.aliasSymbol
  const declarations = symbol?.getDeclarations() ?? []
  return declarations.find(ts.isClassDeclaration)
}

function describeType(checker: ts.TypeChecker, type: ts.Type): string {
  return checker.typeToString(type)
}

/**
 * Scans the given files for request bodies the ValidationPipe cannot enforce.
 *
 * `include` bounds which source files are reported on — production code by
 * default, a fixture directory in the test that proves the check bites.
 */
export function scanForUnvalidatedBodies(fileNames: string[], include: string): Violation[] {
  const program = ts.createProgram({ options: compilerOptions(), rootNames: fileNames })
  return inspect(program, include)
}

function inspect(program: ts.Program, include: string): Violation[] {
  const checker = program.getTypeChecker()
  const violations: Violation[] = []

  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile) continue
    if (!source.fileName.startsWith(include)) continue

    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node)) {
        const handler = node.name.getText()
        const owner = node.parent && ts.isClassDeclaration(node.parent)
          ? node.parent.name?.text ?? '(anonymous)'
          : '(anonymous)'

        for (const parameter of node.parameters) {
          const decorators = ts.getDecorators(parameter) ?? []
          const body = decorators.find((d) => decoratorName(d) === 'Body')
          if (!body) continue

          const { line } = source.getLineAndCharacterOfPosition(parameter.getStart())
          const at = {
            file: path.relative(PROJECT_ROOT, source.fileName),
            line: line + 1,
            handler: `${owner}.${handler}`,
            parameter: parameter.name.getText(),
          }

          const key = bodyArgument(body)
          if (key !== undefined) {
            violations.push({
              ...at,
              reason:
                `@Body('${key}') extracts a property before the ValidationPipe sees a class — ` +
                'nothing about it is validated. Take the whole body as a DTO class instead.',
            })
            continue
          }

          if (!parameter.type) {
            violations.push({ ...at, reason: 'the body parameter has no declared type, so there is nothing to validate against.' })
            continue
          }

          const type = checker.getTypeAtLocation(parameter.type)
          if (!classDeclarationFor(type)) {
            violations.push({
              ...at,
              reason:
                `the body is typed \`${describeType(checker, type)}\`, which carries no class-validator metadata — ` +
                'every property reaches the handler unchecked. Declare a DTO class.',
            })
          }
        }
      }
      ts.forEachChild(node, visit)
    }

    ts.forEachChild(source, visit)
  }

  return violations
}

function main(): void {
  const violations = scanForUnvalidatedBodies(projectFileNames(), path.join(PROJECT_ROOT, 'src'))
  if (violations.length === 0) {
    console.log('check-body-dtos: every @Body() takes a validated DTO class.')
    return
  }

  console.error(`check-body-dtos: ${violations.length} unvalidated request ${violations.length === 1 ? 'body' : 'bodies'}.\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.handler}(${v.parameter})`)
    console.error(`    ${v.reason}\n`)
  }
  process.exitCode = 1
}

if (require.main === module) main()
