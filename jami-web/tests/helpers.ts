/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import { APIRequestContext, expect } from '@playwright/test'

const MOCK_API = 'http://localhost:5002'

/**
 * Wait until the mock server reports at least one connected WebSocket client.
 * The mock only delivers dynamic messages (sent or received) over WebSocket,
 * so pushes fired before the client's socket is open would be silently dropped.
 * This replaces blind `waitForTimeout` sleeps that used to paper over the race.
 */
export async function waitForWsClient(request: APIRequestContext): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MOCK_API}/__ws-clients`)
        return res.ok() ? (await res.json()).count : 0
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0)
}
