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
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import { alpha } from '@mui/material/styles'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { ChangeEvent, MouseEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DeleteIcon, DevicesIcon } from '../../../components/SvgIcon.js'
import { useAuthContext } from '../../../contexts/AuthProvider.js'
import { useRemoveLinkedDevice } from '../../../services/accountQueries.js'
import PasswordRequiredModal from './PasswordRequiredModal.js'

interface DeviceRow {
  deviceId: string
  deviceName: string
}

const rowsPerPageOptions = [10, 25, 50, 100]
const paddingValue = '20px'

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) {
    return -1
  }
  if (b[orderBy] > a[orderBy]) {
    return 1
  }
  return 0
}

type Order = 'asc' | 'desc'

function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key,
): (a: { [key in Key]: string }, b: { [key in Key]: string }) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

interface HeadCell {
  disablePadding: boolean
  id: keyof DeviceRow | 'removeDevice'
  label: string
  numeric: boolean
}

const headCells: readonly HeadCell[] = [
  {
    id: 'deviceName',
    numeric: false,
    disablePadding: true,
    label: 'Device Name',
  },
  {
    id: 'deviceId',
    numeric: false,
    disablePadding: false,
    label: 'Device ID',
  },
]

interface EnhancedTableProps {
  numSelected: number
  onRequestSort: (event: MouseEvent<unknown>, property: keyof DeviceRow) => void
  onSelectAllClick: (event: ChangeEvent<HTMLInputElement>) => void
  order: Order
  orderBy: string
  rowCount: number
}

function EnhancedTableHead(props: EnhancedTableProps) {
  const { onSelectAllClick, order, orderBy, numSelected, rowCount, onRequestSort } = props

  const createSortHandler = (property: keyof DeviceRow) => (event: MouseEvent<unknown>) => {
    onRequestSort(event, property)
  }

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell) => {
          const isSortable = headCell.id !== 'removeDevice'
          return (
            <TableCell
              key={headCell.id}
              sx={{ paddingLeft: paddingValue }}
              align={headCell.numeric ? 'right' : 'left'}
              padding={headCell.disablePadding ? 'none' : 'normal'}
              sortDirection={orderBy === headCell.id ? order : false}
            >
              {isSortable ? (
                <TableSortLabel
                  active={orderBy === headCell.id}
                  direction={orderBy === headCell.id ? order : 'asc'}
                  onClick={createSortHandler(headCell.id as keyof DeviceRow)}
                >
                  {headCell.label}
                  {orderBy === headCell.id ? (
                    <Box component="span" sx={visuallyHidden}>
                      {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                    </Box>
                  ) : null}
                </TableSortLabel>
              ) : (
                headCell.label
              )}
            </TableCell>
          )
        })}
        <TableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
            slotProps={{
              input: {
                'aria-label': 'select all devices',
              },
            }}
          />
        </TableCell>
      </TableRow>
    </TableHead>
  )
}

interface EnhancedTableToolbarProps {
  numSelected: number
  devicesNumber: number
  onDelete: () => void
}

function EnhancedTableToolbar(props: EnhancedTableToolbarProps) {
  const { numSelected, devicesNumber, onDelete } = props
  const { t } = useTranslation()
  const { account } = useAuthContext()

  return (
    <>
      <Toolbar
        sx={[
          {
            pl: { sm: 2 },
            pr: { xs: 1, sm: 1 },
          },
          numSelected > 0 && {
            bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
          },
        ]}
      >
        {numSelected > 0 ? (
          <Typography
            variant="subtitle1"
            component="div"
            sx={{
              color: 'inherit',
              flex: '1 1 100%',
            }}
          >
            {numSelected} selected
          </Typography>
        ) : (
          <Typography variant="h6" id="tableTitle" component="div">
            {t('settings_devices_linked', { count: devicesNumber })}
          </Typography>
        )}
        {numSelected > 0 && (
          <Tooltip title="Delete">
            <IconButton onClick={onDelete}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
      <Box
        sx={{
          paddingLeft: paddingValue,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <Box
          sx={{ display: 'flex', justifyContent: 'start', alignItems: 'center', alignContent: 'center', gap: '5px' }}
        >
          {t('Current device:')}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center', minWidth: 0 }}>
          <Box
            sx={{
              typography: 'body2',
              display: 'flex',
              flexShrink: 0,
              justifyContent: 'center',
              alignContent: 'center',
              gap: '10px',
            }}
          >
            {' '}
            <DevicesIcon sx={{ fontSize: 20, marginTop: '1px' }} />{' '}
            <Box sx={{ textWrap: 'nowrap' }}>{account.details['Account.deviceName']}</Box>
          </Box>{' '}
          <Typography
            data-testid="current-device-id"
            noWrap
            sx={{
              flex: '1 1 auto',
              minWidth: 0,
              fontFamily: 'monospace',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {account.volatileDetails['Account.deviceID']}
          </Typography>
        </Box>
      </Box>
    </>
  )
}

export default function LinkedDevices() {
  const [order, setOrder] = useState<Order>('asc')
  const [orderBy, setOrderBy] = useState<keyof DeviceRow>('deviceName')
  const [selected, setSelected] = useState<readonly string[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0])
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const removeLinkedDeviceMutation = useRemoveLinkedDevice()
  const { account } = useAuthContext()

  const rows = useMemo<DeviceRow[]>(() => {
    const accountDevices = account.devices || {}
    const deviceList: DeviceRow[] = []

    for (const uri in accountDevices) {
      if (uri === account.volatileDetails['Account.deviceID']) continue
      deviceList.push({
        deviceId: uri,
        deviceName: accountDevices[uri],
      })
    }
    return deviceList
  }, [account.devices, account.volatileDetails])

  const handleRequestSort = (event: MouseEvent<unknown>, property: keyof DeviceRow) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleSelectAllClick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = rows.map((r) => r.deviceId)
      setSelected(newSelected)
      return
    }
    setSelected([])
  }

  const handleClick = (event: MouseEvent<unknown>, deviceId: string) => {
    const selectedIndex = selected.indexOf(deviceId)
    let newSelected: readonly string[] = []

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, deviceId)
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1))
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1))
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selected.slice(0, selectedIndex), selected.slice(selectedIndex + 1))
    }
    setSelected(newSelected)
  }

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleDeleteSelected = () => {
    setOpen(true)
  }

  const handleValidateDeleteSelected = (password: string) => {
    selected.forEach((deviceId) => {
      removeLinkedDeviceMutation.mutate({ deviceId: deviceId, password: password })
    })
    setSelected([])
    setOpen(false)
  }

  const visibleRows = useMemo(() => {
    const sorted = [...rows].sort(getComparator(order, orderBy))
    return sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  }, [rows, order, orderBy, page, rowsPerPage])

  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0

  return (
    <>
      <Box sx={{ minWidth: 0, overflowX: 'auto' }}>
        <EnhancedTableToolbar
          numSelected={selected.length}
          devicesNumber={rows.length}
          onDelete={handleDeleteSelected}
        />
        <TableContainer>
          <Table sx={{ minWidth: 600 }} aria-labelledby="tableTitle" size={'medium'}>
            <EnhancedTableHead
              numSelected={selected.length}
              order={order}
              orderBy={orderBy}
              onSelectAllClick={handleSelectAllClick}
              onRequestSort={handleRequestSort}
              rowCount={rows.length}
            />
            <TableBody>
              {visibleRows.map((row, index) => {
                const isItemSelected = selected.includes(row.deviceId)
                const labelId = `enhanced-table-checkbox-${index}`

                return (
                  <TableRow
                    hover
                    onClick={(event) => handleClick(event, row.deviceId)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={row.deviceId}
                    selected={isItemSelected}
                    sx={{ cursor: 'pointer' }}
                  >
                    {/* Device Name */}
                    <TableCell
                      component="th"
                      id={labelId}
                      scope="row"
                      padding="none"
                      sx={{ paddingLeft: paddingValue }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <DevicesIcon sx={{ fontSize: 20 }} />
                        {row.deviceName}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ typography: 'caption', fontFamily: 'monospace' }} align="left">
                      {row.deviceId}
                    </TableCell>
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        slotProps={{
                          input: {
                            'aria-labelledby': labelId,
                          },
                        }}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
              {emptyRows > 0 && (
                <TableRow style={{ height: 53 * emptyRows }}>
                  <TableCell colSpan={4} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={rowsPerPageOptions}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          slotProps={{
            toolbar: {
              sx: {
                flexWrap: 'wrap',
                '& .MuiTablePagination-actions': { ml: { xs: 0, sm: 2.5 } },
              },
            },
          }}
        />
      </Box>
      {open && (
        <PasswordRequiredModal
          open
          onClose={() => {
            setOpen(false)
          }}
          onValidation={handleValidateDeleteSelected}
          title={t('revoke_device')}
          buttonText={t('revoke_device')}
          info={t('revoke_device_info')}
        />
      )}
    </>
  )
}
