/**
 * Proves the build-time guard bites.
 *
 * Two halves, deliberately: the fixtures show WHICH shapes it rejects — and
 * that a real DTO class passes — while the last test runs it over the shipping
 * source, so a new unvalidated body fails the suite as well as the build.
 */
import * as path from 'path'

import { projectFileNames, scanForUnvalidatedBodies } from '../../../scripts/check-body-dtos'

const ROOT = path.resolve(__dirname, '../../..')
const FIXTURES = path.join(ROOT, 'test/fixtures/body-dtos')

describe('check-body-dtos', () => {
  const violations = scanForUnvalidatedBodies(
    [path.join(FIXTURES, 'offending.controller.ts'), path.join(FIXTURES, 'interface.controller.ts')],
    FIXTURES,
  )
  const handlers = violations.map((v) => v.handler)

  it("rejects @Body('field'), which never reaches the ValidationPipe", () => {
    expect(handlers).toContain('OffendingController.extracted')
    const extracted = violations.find((v) => v.handler === 'OffendingController.extracted')
    expect(extracted!.reason).toContain("@Body('code')")
  })

  it('rejects an untyped body', () => {
    expect(handlers).toContain('OffendingController.anyBody')
  })

  it('rejects inline object types, which carry no validator metadata', () => {
    expect(handlers).toEqual(expect.arrayContaining([
      'OffendingController.inline',
      'OffendingController.record',
      'OffendingController.iface',
    ]))
  })

  it('rejects an interface, which looks like a DTO and validates like nothing', () => {
    expect(handlers).toContain('InterfaceBodyController.create')
  })

  it('accepts a class — the only shape class-validator can enforce', () => {
    expect(handlers).not.toContain('OffendingController.ok')
  })

  it('reports the file and line so the failure points at the handler', () => {
    const first = violations[0]
    expect(first.file).toMatch(/offending\.controller\.ts$/)
    expect(first.line).toBeGreaterThan(0)
  })

  it('the shipping source has no unvalidated request body', () => {
    const production = scanForUnvalidatedBodies(projectFileNames(), path.join(ROOT, 'src'))
    expect(production.map((v) => `${v.file}:${v.line} ${v.handler}`)).toEqual([])
  })
})
