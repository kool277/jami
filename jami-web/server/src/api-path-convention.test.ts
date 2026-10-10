/*
 * Copyright (C) 2026 Savoir-faire Linux Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see
 * <https://www.gnu.org/licenses/>.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url))
const routersDirectory = path.join(sourceDirectory, 'routers')
const kebabCaseSegment = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function staticSegments(apiPath: string): string[] {
  return apiPath
    .split('/')
    .filter((segment) => segment.length > 0)
    .filter((segment) => !segment.startsWith(':') && !segment.startsWith('{'))
}

function assertKebabCase(apiPath: string, source: string) {
  for (const segment of staticSegments(apiPath)) {
    assert.match(segment, kebabCaseSegment, `${source} contains non-kebab-case path ${apiPath}`)
  }
}

function expressRoutePaths(source: string): string[] {
  return [...source.matchAll(/\b\w+Router\.(?:get|post|put|patch|delete)\(\s*'([^']*)'/g)].map((match) => match[1])
}

function openApiPaths(source: string): string[] {
  return [...source.matchAll(/^ {2}(\/[^:]+):$/gm)].map((match) => match[1])
}

describe('API path convention', () => {
  it('uses lowercase kebab-case static segments in Express routers', () => {
    const routerFiles = readdirSync(routersDirectory).filter(
      (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
    )
    const routes = routerFiles.flatMap((file) =>
      expressRoutePaths(readFileSync(path.join(routersDirectory, file), 'utf8')),
    )

    assert.ok(routes.length > 0, 'No Express route declarations found')
    for (const route of routes) {
      assertKebabCase(route, 'Express router')
    }
  })

  it('uses lowercase kebab-case static segments in OpenAPI paths', () => {
    const openApi = readFileSync(path.join(sourceDirectory, '..', 'openapi.yaml'), 'utf8')
    const paths = openApiPaths(openApi)

    assert.ok(paths.length > 0, 'No OpenAPI paths found')
    for (const apiPath of paths) {
      assertKebabCase(apiPath, 'OpenAPI')
    }
  })
})
