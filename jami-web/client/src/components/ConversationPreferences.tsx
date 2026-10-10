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

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  ClickAwayListener,
  InputAdornment,
  Popper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Message } from '@savoirfairelinux/jami-web-common'
import { AnimatePresence, motion, type Transition } from 'framer-motion'
import { memo, use, useMemo, useState } from 'react'
import { BlockPicker, ColorResult } from 'react-color'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { useConversationPreferencesColorContext } from '../contexts/ConversationPreferencesColorContext.js'
import { useConversationPreferencesNotificationsContext } from '../contexts/ConversationPreferencesNotificationsContext.js'
import { useConversationPreferencesStateContext } from '../contexts/ConversationPreferencesStateContext.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { CustomThemeContext } from '../contexts/CustomThemeProvider.js'
import { ConversationMember } from '../models/conversation-member.js'
import { useBlockContactMutation, useContactQuery } from '../services/contactQueries.js'
import {
  useConversationPreferencesMutation,
  useMessagesQuery,
  useRemoveMemberFromSwarm,
} from '../services/conversationQueries.js'
import { messageColors } from '../utils/messagecolor.js'
import BaseButton from './common/BaseButton.js'
import BaseIconButton from './common/BaseIconButton.js'
import { ISLAND_MARGIN } from './common/Island.js'
import ContactDetailDialog from './ContactDetailDialog.js'
import ConversationAvatar, { GroupConversationAvatar } from './ConversationAvatar.js'
import ConversationSettingsFileItem from './ConversationSettingsFileItem.js'
import { ConfirmationDialog, useDialogHandler } from './Dialog.js'
import RemoveConversationDialog from './RemoveComversationDialog.js'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ColorsIcon,
  CrownIcon,
  DescriptionIcon,
  ExitToAppIcon,
  FormatCodeIcon,
  GridViewIcon,
  GroupsIcon,
  NotificationsActiveIcon,
  NotificationsOffIcon,
  PermMediaIcon,
  ViewListIcon,
} from './SvgIcon.js'
import { BlockContactIcon, JamiIdIcon, KickMemberIcon, MessageIcon, PersonIcon } from './SvgIcon.js'

export type ConversationType = 'private' | 'group'
type MediaViewMode = 'grid' | 'list'
type PageNavigationDirection = 'forward' | 'backward'

const readOnlyFieldSx = {
  '& .MuiInputBase-input': {
    caretColor: 'transparent',
    cursor: 'default',
  },
}

export function getConversationPreferencesTransition(animationsEnabled: boolean): Transition {
  return animationsEnabled ? { type: 'tween' as const, duration: 0.2, ease: 'easeOut' } : { duration: 0 }
}

export function getConversationPreferencesPageTransition(
  animationsEnabled: boolean,
  direction: PageNavigationDirection,
) {
  const enteringOffset = animationsEnabled ? (direction === 'forward' ? '-100%' : '100%') : 0
  const exitingOffset = animationsEnabled ? (direction === 'forward' ? '100%' : '-100%') : 0

  return {
    animate: { x: 0 },
    exit: { x: exitingOffset },
    initial: { x: enteringOffset },
    transition: getConversationPreferencesTransition(animationsEnabled),
  }
}

export function getInsetCornerRadius(radius: number, inset: number): number {
  return radius - inset
}

export function getConversationType(memberCount: number): ConversationType {
  return memberCount > 2 ? 'group' : 'private'
}

export function getFilesByRecency(files: Message[]): Message[] {
  return [...files].sort((first, second) => second.timestamp - first.timestamp)
}

export function getRecentFiles(files: Message[], limit: number): Message[] {
  return getFilesByRecency(files).slice(0, limit)
}

export function getNextMediaViewMode(viewMode: MediaViewMode): MediaViewMode {
  return viewMode === 'grid' ? 'list' : 'grid'
}

export default function ConversationPreferences() {
  const { t } = useTranslation()
  const { animationsEnabled } = use(CustomThemeContext)
  const { isOpen } = useConversationPreferencesStateContext()
  const { members, conversationId, conversationDisplayName, conversationInfos } = useConversationContext()
  const { account } = useAuthContext()
  const theme = useTheme()
  const [attachmentsPageOpen, setAttachmentsPageOpen] = useState(false)
  const [mediaViewMode, setMediaViewMode] = useState<MediaViewMode>('grid')
  const [pageNavigationDirection, setPageNavigationDirection] = useState<PageNavigationDirection>('forward')

  const isMobile: boolean = useMediaQuery(theme.breakpoints.only('xs'))
  const isMedium: boolean = useMediaQuery(theme.breakpoints.only('sm'))
  const isMoreThanMedium: boolean = useMediaQuery(theme.breakpoints.only('md'))

  if (!isOpen) {
    return
  }

  const isAdmin = members.some((member) => member.contact.uri === account.getUri() && member.role === 'admin')
  const otherMember = members.find((member) => member.contact.uri !== account.getUri())

  function getWidth(): string {
    if (isMobile) {
      return '100vw'
    } else if (isMedium || isMoreThanMedium) {
      return '100%'
    } else {
      return '350px'
    }
  }

  return (
    <motion.span
      style={{ width: getWidth(), minWidth: !(isMedium || isMobile) ? '350px' : 'unset' }}
      initial={{ scale: 1, x: 100 }}
      animate={{ scale: 1, x: 0 }}
      transition={getConversationPreferencesTransition(animationsEnabled)}
    >
      <Card
        sx={{
          backgroundColor: 'background.paper',
          height: 'calc(100vh - 16px)',
          margin: ISLAND_MARGIN,
          ml: 0,
          border: '0.5px solid',
          borderColor: 'divider',
          borderRadius: theme.Panel.borderRadius,
          boxShadow: theme.Panel.shadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
          <AnimatePresence initial={false}>
            <motion.div
              key={attachmentsPageOpen ? 'media' : 'preferences'}
              style={{ display: 'flex', flex: 1, flexDirection: 'column', inset: 0, position: 'absolute' }}
              {...getConversationPreferencesPageTransition(animationsEnabled, pageNavigationDirection)}
            >
              {attachmentsPageOpen ? (
                <CardContent sx={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, padding: 0 }}>
                  <Box
                    sx={{
                      alignItems: 'center',
                      color: 'text.primary',
                      display: 'flex',
                      gap: 1,
                      justifyContent: 'space-between',
                      // Centers the 40px button on the panel's rounded corner arc.
                      marginLeft: `calc(${theme.Panel.borderRadius} - 20px)`,
                      marginRight: `calc(${theme.Panel.borderRadius} - 20px)`,
                      marginTop: `calc(${theme.Panel.borderRadius} - 20px)`,
                    }}
                  >
                    <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                      <BaseIconButton
                        aria-label={t('conversation_files')}
                        tooltip={t('conversation_files')}
                        onClick={() => {
                          setPageNavigationDirection('backward')
                          setAttachmentsPageOpen(false)
                        }}
                        sx={{ height: '40px', width: '40px' }}
                      >
                        <ChevronLeftIcon
                          aria-hidden
                          sx={{ transform: theme.direction === 'rtl' ? 'scaleX(-1)' : undefined }}
                        />
                      </BaseIconButton>
                      <Typography variant="h3">{t('conversation_files')}</Typography>
                    </Box>
                    <BaseIconButton
                      aria-label={t(mediaViewMode === 'grid' ? 'conversation_media_list' : 'conversation_media_grid')}
                      tooltip={t(mediaViewMode === 'grid' ? 'conversation_media_list' : 'conversation_media_grid')}
                      onClick={() => setMediaViewMode(getNextMediaViewMode)}
                      sx={{ height: '40px', width: '40px' }}
                    >
                      {mediaViewMode === 'grid' ? <ViewListIcon aria-hidden /> : <GridViewIcon aria-hidden />}
                    </BaseIconButton>
                  </Box>
                  <Box sx={{ display: 'flex', flex: 1, minHeight: 0, pb: 2, pt: 1, px: 2 }}>
                    <Files showAll={true} viewMode={mediaViewMode} />
                  </Box>
                </CardContent>
              ) : (
                <>
                  <CardHeader
                    title={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {Number(conversationInfos.mode) === 0 ? (
                          <ConversationAvatar
                            contactUri={otherMember?.contact.uri || ''}
                            sx={{ width: '160px', height: '160px' }}
                            displayName={conversationDisplayName}
                          />
                        ) : (
                          <GroupConversationAvatar
                            displayName={conversationDisplayName}
                            members={members}
                            src={conversationInfos.avatar}
                            sx={{ width: '160px', height: '160px' }}
                          />
                        )}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <ConversationNotificationToggle />
                          <ColorPicker conversationId={conversationId} />
                          <ConversationTypeIcon type={getConversationType(members.length)} />
                        </Box>
                      </Box>
                    }
                    sx={{ justifyContent: 'center', '& .MuiCardHeader-content': { flex: 'initial' } }}
                  />
                  <ConversationDetailsFields isAdmin={isAdmin} />
                  <CardContent
                    sx={{
                      display: 'flex',
                      flex: 1,
                      flexDirection: 'column',
                      minHeight: 0,
                      paddingBottom: 1,
                      paddingX: 2,
                      paddingTop: 1,
                      '&:last-child': { paddingBottom: ISLAND_MARGIN },
                    }}
                  >
                    <Box
                      sx={{
                        alignItems: 'center',
                        color: 'text.primary',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PermMediaIcon aria-hidden />
                        <Typography variant="h3">{t('conversation_files')}</Typography>
                      </Box>
                      <BaseIconButton
                        aria-label={t('conversation_files')}
                        tooltip={t('conversation_files')}
                        onClick={() => {
                          setPageNavigationDirection('forward')
                          setAttachmentsPageOpen(true)
                        }}
                      >
                        <ChevronRightIcon aria-hidden />
                      </BaseIconButton>
                    </Box>
                    <Box sx={{ marginTop: 1, display: 'flex', flex: 1, justifyContent: 'center', minHeight: 0 }}>
                      <Files showAll={false} />
                    </Box>
                    <LeaveConversationAction />
                  </CardContent>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Card>
    </motion.span>
  )
}

interface ConversationDetailsFieldsProps {
  isAdmin: boolean
}

const ConversationDetailsFields = ({ isAdmin }: ConversationDetailsFieldsProps) => {
  const { t } = useTranslation()
  const { conversationId, conversationDisplayName, conversationInfos, members } = useConversationContext()
  const isGroup = members.length > 2
  const { account } = useAuthContext()
  const otherMember = members.find((member) => member.contact.uri !== account.getUri())

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        alignContent: 'center',
        width: '100%',
      }}
    >
      <Box sx={{ width: '95%', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField
          fullWidth
          label={isGroup ? t('conversation_details_group_name') : t('contact_details_name')}
          size="small"
          value={conversationDisplayName}
          sx={readOnlyFieldSx}
          slotProps={{
            input: {
              readOnly: true,
              startAdornment: (
                <InputAdornment position="start">
                  {isGroup ? <GroupsIcon aria-hidden /> : <PersonIcon aria-hidden />}
                </InputAdornment>
              ),
            },
          }}
        />
        {isGroup && (
          <TextField
            fullWidth
            label={t('conversation_details_description')}
            size="small"
            value={conversationInfos.description || ''}
            placeholder={t('conversation_details_no_description')}
            sx={readOnlyFieldSx}
            slotProps={{
              input: {
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <DescriptionIcon aria-hidden />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
        {!isGroup && (
          <TextField
            fullWidth
            label={t('conversation_details_jami_id')}
            size="small"
            value={otherMember?.contact.uri || ''}
            sx={[readOnlyFieldSx, { '& .MuiInputBase-input': { fontFamily: 'monospace' } }]}
            slotProps={{
              input: {
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <JamiIdIcon size={20} aria-hidden />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
        <TextField
          fullWidth
          label={t('conversation_details_swarm_id')}
          size="small"
          value={conversationId}
          sx={[readOnlyFieldSx, { '& .MuiInputBase-input': { fontFamily: 'monospace' } }]}
          slotProps={{
            input: {
              readOnly: true,
              startAdornment: (
                <InputAdornment position="start">
                  <FormatCodeIcon aria-hidden />
                </InputAdornment>
              ),
            },
          }}
        />
        {isGroup && <Members isAdmin={isAdmin} />}
      </Box>
    </Box>
  )
}

const ConversationNotificationToggle = () => {
  const { t } = useTranslation()
  const { conversationId } = useConversationContext()
  const { ignoreNotifications } = useConversationPreferencesNotificationsContext()
  const conversationPreferencesMutation = useConversationPreferencesMutation(conversationId)

  return (
    <BaseIconButton
      aria-label={t('mute_conversation')}
      aria-pressed={ignoreNotifications}
      tooltip={t('mute_conversation')}
      onClick={() => conversationPreferencesMutation.mutate({ ignoreNotifications: !ignoreNotifications })}
      sx={{ backgroundColor: ignoreNotifications ? 'action.selected' : 'transparent' }}
    >
      {ignoreNotifications ? <NotificationsOffIcon /> : <NotificationsActiveIcon />}
    </BaseIconButton>
  )
}

interface ConversationTypeIconProps {
  type: ConversationType
}

const ConversationTypeIcon = ({ type }: ConversationTypeIconProps) => {
  const { t } = useTranslation()

  return (
    <Box
      role="img"
      aria-label={t(type === 'group' ? 'conversation_type_group' : 'conversation_type_private')}
      sx={{ display: 'flex', justifyContent: 'center' }}
    >
      {type === 'group' ? <GroupsIcon aria-hidden /> : <PersonIcon aria-hidden />}
    </Box>
  )
}

interface ContactDialogProps {
  isBlocking: boolean
  open: boolean
  closeContactDialog: () => void
  currentContactId: string
}

const ContactDialog = memo(({ open, closeContactDialog, currentContactId }: ContactDialogProps) => {
  const blockContactMutation = useBlockContactMutation()

  const blockContact = (): void => {
    blockContactMutation.mutate(currentContactId)
    closeContactDialog()
  }

  const { t } = useTranslation()
  return (
    <ConfirmationDialog
      open={open}
      onClose={closeContactDialog}
      title={t('dialog_confirm_title_default')}
      content={t('contact_ask_confirm_block')}
      onConfirm={blockContact}
      confirmButtonText={t('contact_confirm_block')}
    />
  )
})

interface MembersProps {
  isAdmin: boolean
}

const Members = ({ isAdmin }: MembersProps) => {
  const { members } = useConversationContext()
  return (
    <Box sx={{ display: 'flex', width: '100%', flexDirection: 'column', maxHeight: '180px', overflowY: 'auto' }}>
      {members.map((member) => {
        return <MemberInfo key={member.contact.uri} member={member} isAdmin={isAdmin} />
      })}
    </Box>
  )
}

interface MemberInfoProps {
  isAdmin: boolean
  member: ConversationMember
}

const MemberInfo = ({ member, isAdmin }: MemberInfoProps) => {
  const [isBlocking, setIsBlocking] = useState(true)
  const { account } = useAuthContext()
  const [contactDetailDialogOpen, setContactDetailDialogOpen] = useState<boolean>(false)
  const singleContactQuery = useContactQuery(member.contact.uri)
  const { conversationId: currentConversationId } = useConversationContext()
  const { data: contactDetail } = singleContactQuery
  const navigate = useNavigate()
  const kickMemberMutation = useRemoveMemberFromSwarm(currentConversationId)
  const isBanned = member.role === 'banned'
  const { t } = useTranslation()
  const {
    props: { open: dialogOpen, onClose: closeContactDialog },
    openDialog: openContactDialog,
  } = useDialogHandler()

  const ContactDetailDialogElement = useMemo(() => {
    const onClosingContactDetailDialog = () => setContactDetailDialogOpen(false)
    return (
      <ContactDetailDialog
        contactDetail={contactDetail}
        open={contactDetailDialogOpen}
        onClose={onClosingContactDetailDialog}
      />
    )
  }, [contactDetail, contactDetailDialogOpen])

  const bestName = member.getDisplayName() || member.contact.registeredName || member.contact.uri

  return (
    <>
      <ContactDialog
        isBlocking={isBlocking}
        open={dialogOpen}
        closeContactDialog={closeContactDialog}
        currentContactId={member.contact.uri}
      />
      {ContactDetailDialogElement}
      <Box
        key={member.contact.uri}
        role="button"
        tabIndex={0}
        aria-label={t('contact_details_text')}
        onClick={() => setContactDetailDialogOpen(true)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
          event.preventDefault()
          setContactDetailDialogOpen(true)
        }}
        sx={{
          '&:focus-within .member-actions, &:hover .member-actions': {
            opacity: 1,
            pointerEvents: 'auto',
          },
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          cursor: 'pointer',
          position: 'relative',
          width: '100%',
          padding: '2%',
          justifyContent: 'space-between',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignContent: 'center',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          <Box sx={{ display: 'flex', position: 'relative' }}>
            <ConversationAvatar presence={true} contactUri={member.contact.uri} displayName={bestName} />
            {member.role === 'admin' && (
              <Box
                role="img"
                aria-label={t('admin')}
                sx={{
                  color: 'warning.main',
                  lineHeight: 0,
                  position: 'absolute',
                  right: -5,
                  top: -8,
                  transform: 'rotate(15deg)',
                }}
              >
                <CrownIcon aria-hidden sx={{ filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5))', fontSize: 18 }} />
              </Box>
            )}
          </Box>
          <Typography
            noWrap
            title={bestName}
            sx={{ flex: 1, marginLeft: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {bestName}
          </Typography>
        </Box>
        {member.contact.uri !== account.getUri() && (
          <Box
            className="member-actions"
            sx={{
              display: 'flex',
              gap: 0.5,
              opacity: 0,
              pointerEvents: 'none',
              position: 'absolute',
              right: '2%',
              transition: 'opacity 150ms ease-out',
            }}
          >
            <BaseIconButton
              aria-label={t('contact_block')}
              tooltip={t('contact_block')}
              onClick={(event) => {
                event.stopPropagation()
                openContactDialog()
                setIsBlocking(true)
              }}
              sx={{
                '&:hover': { backgroundColor: 'error.dark' },
                backgroundColor: 'error.main',
                color: 'error.contrastText',
                height: 32,
                width: 32,
              }}
            >
              <BlockContactIcon aria-hidden fontSize="small" />
            </BaseIconButton>
            {contactDetail?.conversationId && (
              <BaseIconButton
                aria-label={t('go_to_conversation')}
                tooltip={t('go_to_conversation')}
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(`/conversation/${contactDetail.conversationId}`)
                }}
                sx={{
                  '&:hover': { backgroundColor: 'primary.dark' },
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  height: 32,
                  width: 32,
                }}
              >
                <MessageIcon aria-hidden fontSize="small" />
              </BaseIconButton>
            )}
            {isAdmin && !isBanned && (
              <BaseIconButton
                aria-label={t('kick_member')}
                tooltip={t('kick_member')}
                onClick={(event) => {
                  event.stopPropagation()
                  kickMemberMutation.mutate(member.contact.uri)
                }}
                sx={{
                  '&:hover': { backgroundColor: 'warning.dark' },
                  backgroundColor: 'warning.main',
                  color: 'warning.contrastText',
                  height: 32,
                  width: 32,
                }}
              >
                <KickMemberIcon aria-hidden fontSize="small" />
              </BaseIconButton>
            )}
          </Box>
        )}
      </Box>
    </>
  )
}

interface FilesProps {
  showAll: boolean
  viewMode?: MediaViewMode
}

const ATTACHMENT_PREVIEW_LIMIT = 6

export const Files = ({ showAll, viewMode = 'grid' }: FilesProps) => {
  // TODO : Fetch store blob url of files alredy loaded
  // in the conversation to avoid loading them again
  const { conversationId } = useConversationContext()
  const messagesQuery = useMessagesQuery(conversationId, showAll)
  const files = (messagesQuery.data ?? []).filter((message) => message.fileId)
  const displayedFiles = showAll ? getFilesByRecency(files) : getRecentFiles(files, ATTACHMENT_PREVIEW_LIMIT)
  const { t } = useTranslation()

  if (messagesQuery.isLoading) {
    return null
  }

  if (messagesQuery.isSuccess && files.length === 0) {
    return (
      <Box>
        <Typography>{t('no_files_found')}</Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: viewMode === 'list' ? '1fr' : 'repeat(3, 1fr)',
        gap: '8px',
        width: '100%',
        height: '100%',
        overflowY: showAll ? 'auto' : 'hidden',
        paddingBottom: '8px',
        overflowX: 'hidden',
        alignContent: 'start',
      }}
    >
      {displayedFiles.map((file) => {
        return (
          <ConversationSettingsFileItem
            key={file.id + file.fileId}
            displayName={file?.displayName || ''}
            timeStamp={file.timestamp}
            totalSize={Number(file?.totalSize) || 0}
            fileId={file?.fileId || ''}
            author={file.author}
            messageId={file.id}
            listView={viewMode === 'list'}
          />
        )
      })}
    </Box>
  )
}

const LeaveConversationAction = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const RemoveConversationDialogHandler = useDialogHandler()
  const { conversationId } = useConversationContext()
  const cardContentPadding = Number.parseFloat(theme.spacing(2))
  const bottomInset = Number.parseFloat(ISLAND_MARGIN)
  const panelRadius = Number.parseFloat(`${theme.Panel.borderRadius}`)
  const buttonCornerRadius = getInsetCornerRadius(panelRadius, bottomInset)
  const horizontalMargin = bottomInset - cardContentPadding
  const widthExpansion = -2 * horizontalMargin

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          alignContent: 'center',
          marginX: `${horizontalMargin}px`,
          width: `calc(100% + ${widthExpansion}px)`,
        }}
      >
        <BaseButton
          variant="contained"
          sx={{
            backgroundColor: 'red',
            borderRadius: `${buttonCornerRadius}px`,
            display: 'flex',
            justifyContent: 'space-evenly',
            minHeight: `${buttonCornerRadius * 2}px`,
            width: '100%',
            '&:hover': { backgroundColor: 'red' },
          }}
          onClick={() => {
            RemoveConversationDialogHandler.openDialog()
          }}
        >
          {t('leave_conversation')}
          <ExitToAppIcon />
        </BaseButton>
      </Box>
      <RemoveConversationDialog
        {...RemoveConversationDialogHandler.props}
        conversationId={conversationId}
        isCurrent={true} // indicates if we are in the conversation we want to remove
      />
    </>
  )
}

interface ColorPickerProps {
  conversationId: string
}

export const ColorPicker = ({ conversationId }: ColorPickerProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { conversationColor } = useConversationPreferencesColorContext()
  const [open, setOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const conversationPreferencesMutation = useConversationPreferencesMutation(conversationId)

  const handleNewColor = (color: string) => {
    conversationPreferencesMutation.mutate({ color })
  }

  const handleCloseColorPicker = () => {
    setAnchorEl(null)
    setOpen(false)
  }

  const handleOpenColorPicker = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (open) {
      handleCloseColorPicker()
    } else {
      setAnchorEl(event.currentTarget)
      setOpen(true)
    }
  }

  return (
    <ClickAwayListener onClickAway={handleCloseColorPicker}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <BaseButton
            aria-label={t('conversation_color')}
            aria-expanded={open}
            onClick={(event) => handleOpenColorPicker(event)}
            variant="text"
            sx={{
              width: '30px',
              minWidth: 0,
              height: '30px',
              padding: 0,
              backgroundColor: conversationColor,
              borderRadius: '50%',
              color: theme.palette.getContrastText(conversationColor),
              '&:hover': { backgroundColor: conversationColor },
            }}
          >
            <ColorsIcon aria-hidden fontSize="small" />
          </BaseButton>
          <Popper sx={{ zIndex: 2 }} open={open} anchorEl={anchorEl} placement="bottom">
            <BlockPicker
              triangle="hide"
              styles={{}}
              color={conversationColor}
              colors={messageColors}
              onChange={(color: ColorResult) => {
                handleNewColor(color.hex)
              }}
            />
          </Popper>
        </Box>
      </Box>
    </ClickAwayListener>
  )
}
