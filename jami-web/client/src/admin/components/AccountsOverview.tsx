/*
 * Copyright (C) 2022-2025 Savoir-faire Linux Inc.
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
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { alpha } from '@mui/material/styles'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { AccountOverview } from '@savoirfairelinux/jami-web-common'
import { t } from 'i18next'
import { ChangeEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DeleteIcon,
  MoreVerticalIcon,
  PasswordIcon,
  PeopleWithPlusSignIcon,
  SearchRoundedIcon,
} from '../../components/SvgIcon.js'
import { SettingsPage, SettingsSection } from '../../settings/components/SettingsPage.js'
import { getDataSizeUnits } from '../../utils/units.js'
import {
  useCreateAccount,
  useDeleteAccounts,
  useGetAllAccounts,
  useResetAccountPassword,
} from '../services/adminQueries.js'
import AdminAccountDialog from './AdminAccountDialog.js'
import ValidationRequiredModal from './ValidationRequiredModal.js'

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) {
    return -1
  }
  if (b[orderBy] > a[orderBy]) {
    return 1
  }
  return 0
}

const rowPerPagesOptions = [10, 25, 50, 100]

type Order = 'asc' | 'desc'

function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key,
): (a: { [key in Key]?: number | string }, b: { [key in Key]?: number | string }) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

interface HeadCell {
  disablePadding: boolean
  id: keyof AccountOverview
  label: string
  numeric: boolean
}

const headCells: readonly HeadCell[] = [
  {
    id: 'username',
    numeric: false,
    disablePadding: true,
    label: t('admin_page_accounts_overview_title_username'),
  },
  {
    id: 'accountId',
    numeric: true,
    disablePadding: false,
    label: t('account_id'),
  },
  {
    id: 'auth',
    numeric: true,
    disablePadding: false,
    label: t('admin_page_accounts_overview_title_auth'),
  },
  {
    id: 'storage',
    numeric: true,
    disablePadding: false,
    label: t('admin_page_accounts_overview_title_storage'),
  },
]

interface EnhancedTableProps {
  numSelected: number
  onRequestSort: (event: React.MouseEvent<unknown>, property: keyof AccountOverview) => void
  onSelectAllClick: (event: ChangeEvent<HTMLInputElement>) => void
  order: Order
  orderBy: string
  rowCount: number
}

function EnhancedTableHead(props: EnhancedTableProps) {
  const { onSelectAllClick, order, orderBy, numSelected, rowCount, onRequestSort } = props
  const createSortHandler = (property: keyof AccountOverview) => (event: React.MouseEvent<unknown>) => {
    onRequestSort(event, property)
  }

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell) => (
          <TableCell
            sx={{ paddingLeft: '0.5%' }}
            key={headCell.id}
            align={headCell.numeric ? 'right' : 'left'}
            padding={headCell.disablePadding ? 'none' : 'normal'}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : 'asc'}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
        <TableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
            slotProps={{
              input: {
                'aria-label': 'select all desserts',
              },
            }}
          />
        </TableCell>
        <TableCell padding="checkbox" />
      </TableRow>
    </TableHead>
  )
}
interface EnhancedTableToolbarProps {
  numSelected: number
  accountsNumber: number
  onDelete: () => void
}
function EnhancedTableToolbar(props: EnhancedTableToolbarProps) {
  const { numSelected, accountsNumber, onDelete } = props
  const { t } = useTranslation()
  return (
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
          {t('admin_page_accounts_overview_title', { count: accountsNumber })}
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
  )
}
export default function AccountsOverview() {
  const { i18n } = useTranslation()
  const [order, setOrder] = useState<Order>('asc')
  const [orderBy, setOrderBy] = useState<keyof AccountOverview>('username')
  const [selected, setSelected] = useState<readonly string[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(rowPerPagesOptions[0])
  const getAllAccounts = useGetAllAccounts()
  const accountDeletionMutation = useDeleteAccounts()
  const accountCreationMutation = useCreateAccount()
  const accountPasswordMutation = useResetAccountPassword()
  const [modalOpen, setModalOpen] = useState(false)
  const [accountDialogMode, setAccountDialogMode] = useState<'create' | 'reset-password' | null>(null)
  const [actionAccount, setActionAccount] = useState<AccountOverview | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [search, setSearch] = useState('')
  const [authFilter, setAuthFilter] = useState('all')

  const rows = useMemo(() => {
    if (getAllAccounts.data) {
      return getAllAccounts.data
    }
    return []
  }, [getAllAccounts.data])

  const handleRequestSort = (event: React.MouseEvent<unknown>, property: keyof AccountOverview) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleSelectAllClick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = filteredRows.map((n: AccountOverview) => n.accountUri)
      setSelected(newSelected)
      return
    }
    setSelected([])
  }

  const handleClick = (event: React.MouseEvent<unknown>, accountUri: string) => {
    const selectedIndex = selected.indexOf(accountUri)
    let newSelected: readonly string[] = []

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, accountUri)
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1))
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1))
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selected.slice(0, selectedIndex), selected.slice(selectedIndex + 1))
    }
    setSelected(newSelected)
  }

  const handleSubmitDeletion = () => {
    setModalOpen(true)
  }

  const handleSubmitDeletionValidation = () => {
    const accountsToDelete: AccountOverview[] = []
    for (const account of rows) {
      if (selected.includes(account.accountUri)) {
        accountsToDelete.push(account)
      }
    }
    accountDeletionMutation.mutate(accountsToDelete)
    setSelected([])
    setModalOpen(false)
  }

  const handleAccountDialogSubmit = async ({ username, password }: { username?: string; password: string }) => {
    if (accountDialogMode === 'create' && username) {
      await accountCreationMutation.mutateAsync({ username, password })
    } else if (accountDialogMode === 'reset-password' && actionAccount) {
      await accountPasswordMutation.mutateAsync({ accountId: actionAccount.accountId, password })
    }
    setAccountDialogMode(null)
    setActionAccount(null)
  }

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const filteredRows = rows.filter(
    (row) =>
      (authFilter === 'all' || row.auth === authFilter) &&
      [row.username, row.accountUri, row.accountId].some((value) => value.toLowerCase().includes(search.toLowerCase())),
  )

  const visibleRows = useMemo(
    () =>
      [...filteredRows].sort(getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredRows, order, orderBy, page, rowsPerPage],
  )

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - filteredRows.length) : 0

  return (
    <SettingsPage contentMaxWidth={960}>
      <SettingsSection list={false}>
        <EnhancedTableToolbar
          numSelected={selected.length}
          accountsNumber={rows.length}
          onDelete={handleSubmitDeletion}
        />
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, px: 2, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label={t('admin_account_search')}
            value={search}
            slotProps={{
              input: {
                startAdornment: <SearchRoundedIcon />,
              },
            }}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="account-auth-filter-label">{t('admin_account_auth_filter')}</InputLabel>
            <Select
              size="small"
              labelId="account-auth-filter-label"
              label={t('admin_account_auth_filter')}
              value={authFilter}
              onChange={(event) => {
                setAuthFilter(event.target.value)
                setPage(0)
              }}
            >
              <MenuItem value="all">{t('all')}</MenuItem>
              {[...new Set(rows.map((row) => row.auth))].map((auth) => (
                <MenuItem key={auth} value={auth}>
                  {auth}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<PeopleWithPlusSignIcon />}
            sx={{ flexShrink: 0 }}
            onClick={() => setAccountDialogMode('create')}
          >
            {t('admin_account_add')}
          </Button>
        </Box>
        <TableContainer sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle" size="medium">
            <EnhancedTableHead
              numSelected={selected.length}
              order={order}
              orderBy={orderBy}
              onSelectAllClick={handleSelectAllClick}
              onRequestSort={handleRequestSort}
              rowCount={filteredRows.length}
            />
            <TableBody>
              {visibleRows.map((row, index) => {
                const isItemSelected = selected.includes(row.accountUri)
                const labelId = `enhanced-table-checkbox-${index}`

                return (
                  <TableRow
                    hover
                    onClick={(event) => handleClick(event, row.accountUri)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={row.accountUri}
                    selected={isItemSelected}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ paddingLeft: '0.5%' }} component="th" id={labelId} scope="row" padding="none">
                      {row.username}
                      <Box sx={{ typography: 'caption', color: 'text.secondary', fontFamily: 'monospace' }}>
                        {row.accountUri}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {row.accountId}
                    </TableCell>
                    <TableCell align="right">{row.auth}</TableCell>
                    <TableCell align="right">{getDataSizeUnits(row.storage, i18n.language)}</TableCell>
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
                    <TableCell padding="checkbox">
                      <IconButton
                        aria-label={t('admin_account_actions')}
                        onClick={(event) => {
                          event.stopPropagation()
                          setActionAccount(row)
                          setMenuAnchor(event.currentTarget)
                        }}
                      >
                        <MoreVerticalIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
              {emptyRows > 0 && (
                <TableRow
                  style={{
                    height: 53 * emptyRows,
                  }}
                >
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={rowPerPagesOptions}
          component="div"
          count={filteredRows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </SettingsSection>
      {modalOpen && (
        <ValidationRequiredModal
          info={t('remove_account_info')}
          title={t('dialog_confirm_title_default')}
          buttonText={t('remove_button')}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onValidation={handleSubmitDeletionValidation}
        />
      )}
      <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          disabled={actionAccount?.auth !== 'local'}
          onClick={() => {
            setMenuAnchor(null)
            setAccountDialogMode('reset-password')
          }}
        >
          <PasswordIcon sx={{ mr: 1 }} />
          {t('change_password')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionAccount) {
              setSelected([actionAccount.accountUri])
              setModalOpen(true)
            }
            setMenuAnchor(null)
          }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          {t('remove_button')}
        </MenuItem>
      </Menu>
      {accountDialogMode && (
        <AdminAccountDialog
          open
          mode={accountDialogMode}
          onClose={() => {
            setAccountDialogMode(null)
            setActionAccount(null)
          }}
          onSubmit={handleAccountDialogSubmit}
          pending={accountCreationMutation.isPending || accountPasswordMutation.isPending}
        />
      )}
    </SettingsPage>
  )
}
