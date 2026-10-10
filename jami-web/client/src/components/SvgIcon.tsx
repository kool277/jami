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
import { Box, type SvgIconProps } from '@mui/material'
import React from 'react'

import JamiIDLogoSvg from '../icons/jami-id-logo.svg?react'
import MaterialSymbol from './MaterialSymbol.js'

const bidirectionalSymbols = new Set([
  'reply',
  'send',
  'arrow_back',
  'format_list_numbered',
  'call_missed',
  'chevron_left',
  'exit_to_app',
  'chevron_right',
  'format_list_bulleted',
])

/** Callers may override the fill, which is how a selected state is drawn. */
export type SymbolIconProps = SvgIconProps & { filled?: boolean }

const ms = (symbol: string, filled?: boolean) => {
  const Comp = (props: any) => (
    <MaterialSymbol bidirectional={bidirectionalSymbols.has(symbol)} symbol={symbol} filled={filled} {...props} />
  )
  Comp.displayName = `MS_${symbol}`
  return Comp as React.ComponentType<SymbolIconProps>
}

export const ArrowIcon = ms('arrow_back')
export const Arrow2Icon = ms('send')
export const Arrow3Icon = ms('reply')
export const Arrow4Icon = ms('reply')
export const ArrowDownIcon = ms('arrow_downward')
export const ArrowLeftCurved = ms('call_missed')
export const ArrowLeftDown = ms('south_west')
export const ArrowRightUp = ms('north_east')
export const ArrowHeadDown = ms('expand_more')
export const ArrowHeadUp = ms('expand_less')
export const AddReactionIcon = ms('add_reaction')
export const AudioCallIcon = ms('call')
export const BadgeIcon = ms('badge')
export const BlockContactIcon = ms('block')
export const KickMemberIcon = ms('person_remove')
export const KeyIcon = ms('key')
export const CallEndIcon = ms('call_end')
export const CameraIcon = ms('photo_camera')
export const CameraInBubbleIcon = ms('videocam')
export const CancelIcon = ms('cancel')
export const ChatBubbleIcon = ms('chat_bubble')
export const CheckedIcon = ms('check_circle')
export const CheckMarkIcon = ms('check')
export const ChevronLeftIcon = ms('chevron_left')
export const ChevronRightIcon = ms('chevron_right')
export const ColorFillIcon = ms('format_color_fill')
export const ColorsIcon = ms('colors')
export const ContactIcon = ms('contacts')
export const CrownIcon = ms('crown')
export const CrossedEyeIcon = ms('visibility_off')
export const CrossIcon = ms('close')
export const DataThresholdingIcon = ms('data_thresholding')
export const DnsIcon = ms('dns')
export const DoorOpenIcon = ms('door_open')
export const ExtensionIcon = ms('extension')
export const EmojiIcon = ms('mood')
export const ExpandLessIcon = ms('expand_less')
export const EyeIcon = ms('visibility')
export const FavoriteBorderIcon = ms('favorite_border')
export const FeedbackIcon = ms('feedback')
export const FrameExclamationIcon = ms('frame_exclamation')
export const FileIcon = ms('description')
export const FingerprintIcon = ms('fingerprint')
export const FolderIcon = ms('folder')
export const ForwardIcon = ms('forward')
export const FullScreenIcon = ms('fullscreen')
export const GroupAddIcon = ms('group_add')
export const GridViewIcon = ms('grid_view')
export const InfoIcon = ms('info')
export const ListIcon = ms('menu')
export const LanguageIcon = ms('language')
export const LiveTvIcon = ms('live_tv')
export const LockIcon = ms('lock')
export const MarkChatReadIcon = ms('mark_chat_read')
export const OpenInNewIcon = ms('open_in_new')
export const QrCodeIcon = ms('qr_code')
export const MessageIcon = ms('chat')
export const NotificationsActiveIcon = ms('notifications_active')
export const NotificationsOffIcon = ms('notifications_off')
export const PaintIcon = ms('palette')
export const PasswordIcon = ms('password')
export const PermMediaIcon = ms('perm_media')
export const TipIcon = ms('lightbulb')
export const Timer3AltIcon = ms('timer_3_alt_1')
export const TimerOffIcon = ms('timer_off')
export const TokenIcon = ms('token')
export const JamiIdIcon = ({ sx, size = 24, ...props }: SvgIconProps & { size?: number | string }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', ...sx }}>
    <JamiIDLogoSvg {...props} style={{ width: size, height: 'auto' }} />
  </Box>
)
export const DownloadFileIcon = ms('download')
export const MoreVerticalIcon = ms('more_vert')
export const MicroIcon = ms('mic')
export const MicroOffIcon = ms('mic_off')
export const MicroInBubbleIcon = ms('mic')
export const OppositeArrowsIcon = ms('open_in_full')
export const OutgoingMailIcon = ms('outgoing_mail')
export const PaperClipIcon = ms('attach_file')
export const PenIcon = ms('edit')
export const PeopleGroupIcon = ms('groups')
export const PeopleWithPlusSignIcon = ms('person_add')
export const PersonIcon = ms('person')
export const PersonWithCrossMarkIcon = ms('person_off')
export const PlaceAudioCallIcon = ms('call')
export const RecordingIcon = ms('fiber_manual_record', true)
export const RoundCloseIcon = ms('close')
export const RoundCrossIcon = ms('cancel')
export const RoundSaltireIcon = ms('cancel')
export const SaltireIcon = ms('close')
export const ScreenShareArrowIcon = ms('screen_share')
export const ScreenShareRegularIcon = ms('present_to_all')
export const ScreenShareScreenAreaIcon = ms('screenshot_monitor')
export const ScreenShareStopIcon = ms('stop_screen_share')
export const SettingsIcon = ms('settings')
export const SettingsBackupRestoreIcon = ms('settings_backup_restore')
export const SentimentCalmIcon = ms('sentiment_calm')
export const SentimentExcitedIcon = ms('sentiment_excited')
export const SentimentVeryDissatisfiedIcon = ms('sentiment_very_dissatisfied')
export const MoodIcon = ms('mood')
export const TrashBinIcon = ms('delete')
export const TwoSheetsIcon = ms('content_copy')
export const VideoCallIcon = ms('videocam')
export const VideoCameraIcon = ms('videocam')
export const VideoCameraOffIcon = ms('videocam_off')
export const VolumeIcon = ms('volume_up')
export const WindowIcon = ms('web_asset')
export const WavingHandIcon = ms('waving_hand')

// Additional icons (replacing @mui/icons-material)
export const AddCircleIcon = ms('add_circle')
export const AddModeratorIcon = ms('add_moderator')
export const AccountCircleIcon = ms('account_circle')
export const AdminPanelSettingsIcon = ms('admin_panel_settings')
export const ArrowBackIcon = ms('arrow_back')
export const ArrowBackIosNewIcon = ms('arrow_back_ios_new')
export const AttachFileIcon = ms('attach_file')
export const AudioFileIcon = ms('audio_file')
export const CloseIcon = ms('close')
export const ContentCopyIcon = ms('content_copy')
export const DeleteIcon = ms('delete')
export const DescriptionIcon = ms('description')
export const DevicesIcon = ms('devices')
export const DoneIcon = ms('done')
export const DownloadIcon = ms('download')
export const ExitToAppIcon = ms('exit_to_app')
export const GppMaybeIcon = ms('gpp_maybe')
export const GroupAddRoundedIcon = ms('group_add')
export const GroupsIcon = ms('groups')
export const InfoOutlinedIcon = ms('info')
export const LinkIcon = ms('link')
export const LoginIcon = ms('login')
export const LogoutIcon = ms('logout')
export const MailIcon = ms('mail')
export const ManageAccountsIcon = ms('manage_accounts')
export const MoreHorizIcon = ms('more_horiz')
export const PauseIcon = ms('pause')
export const PeopleIcon = ms('people')
export const PictureAsPdfIcon = ms('picture_as_pdf')
export const PlayArrowIcon = ms('play_arrow')
export const QuestionAnswerIcon = ms('question_answer')
export const RefreshOutlinedIcon = ms('refresh')
export const SearchRoundedIcon = ms('search')
export const VideoFileIcon = ms('video_file')
export const ViewListIcon = ms('format_list_bulleted')
export const VolunteerActivismIcon = ms('volunteer_activism')
export const WarningIcon = ms('warning')
export const FormatBoldIcon = ms('format_bold')
export const FormatItalicIcon = ms('format_italic')
export const FormatStrikethroughIcon = ms('strikethrough_s')
export const FormatTitleIcon = ms('title')
export const FormatCodeIcon = ms('code')
export const FormatQuoteIcon = ms('format_quote')
export const FormatListBulletedIcon = ms('format_list_bulleted')
export const FormatListNumberedIcon = ms('format_list_numbered')
