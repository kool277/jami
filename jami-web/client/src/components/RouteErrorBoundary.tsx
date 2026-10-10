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
import { Box, Button, Typography } from '@mui/material'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

const RouteErrorBoundary = () => {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const errorMessage = error instanceof Error ? error.message : undefined

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        justifyContent: 'center',
        minHeight: '100vh',
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography component="h1" variant="h4">
        {notFound ? 'Page not found' : 'Something went wrong'}
      </Typography>
      <Typography color="text.secondary">
        {notFound ? 'The page you requested does not exist.' : 'Please reload the page and try again.'}
      </Typography>
      {import.meta.env.DEV && errorMessage && (
        <Typography color="error" component="pre" sx={{ maxWidth: '100%', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {errorMessage}
        </Typography>
      )}
      <Button onClick={() => window.location.reload()} variant="contained">
        Reload
      </Button>
    </Box>
  )
}

export default RouteErrorBoundary
