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
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { create as createFont } from 'fontkit'
import subsetFont from 'subset-font'

const symbols = [
  'account_circle',
  'add_circle',
  'add_moderator',
  'add_reaction',
  'admin_panel_settings',
  'arrow_back',
  'arrow_back_ios_new',
  'arrow_downward',
  'attach_file',
  'attachment',
  'audio_file',
  'badge',
  'block',
  'call',
  'call_end',
  'call_made',
  'call_missed',
  'call_received',
  'cancel',
  'chat',
  'chat_bubble',
  'check',
  'check_circle',
  'chevron_left',
  'chevron_right',
  'close',
  'code',
  'colors',
  'contacts',
  'content_copy',
  'crown',
  'data_thresholding',
  'delete',
  'description',
  'devices',
  'dns',
  'done',
  'door_open',
  'download',
  'edit',
  'exit_to_app',
  'expand_less',
  'expand_more',
  'extension',
  'favorite_border',
  'feedback',
  'fiber_manual_record',
  'fingerprint',
  'folder',
  'format_bold',
  'format_color_fill',
  'format_italic',
  'format_list_bulleted',
  'format_list_numbered',
  'format_quote',
  'forward',
  'frame_exclamation',
  'fullscreen',
  'gpp_maybe',
  'grid_view',
  'group_add',
  'groups',
  'image',
  'info',
  'key',
  'language',
  'lightbulb',
  'link',
  'live_tv',
  'lock',
  'login',
  'logout',
  'mail',
  'mark_chat_read',
  'manage_accounts',
  'menu',
  'mic',
  'mic_off',
  'mood',
  'more_horiz',
  'more_vert',
  'north_east',
  'notifications_active',
  'notifications_off',
  'open_in_full',
  'open_in_new',
  'outgoing_mail',
  'palette',
  'password',
  'pause',
  'people',
  'perm_media',
  'person',
  'person_add',
  'person_off',
  'person_remove',
  'photo_camera',
  'picture_as_pdf',
  'play_arrow',
  'present_to_all',
  'progress_activity',
  'qr_code',
  'question_answer',
  'refresh',
  'reply',
  'screen_share',
  'screenshot_monitor',
  'search',
  'send',
  'sentiment_calm',
  'sentiment_excited',
  'sentiment_very_dissatisfied',
  'settings',
  'settings_backup_restore',
  'smart_display',
  'south_west',
  'stop_screen_share',
  'strikethrough_s',
  'timer_3_alt_1',
  'timer_off',
  'title',
  'token',
  'video_file',
  'videocam',
  'videocam_off',
  'visibility',
  'visibility_off',
  'volume_up',
  'volunteer_activism',
  'warning',
  'waving_hand',
  'web_asset',
]

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientDirectory = path.resolve(scriptDirectory, '..')
const sourcePath = path.resolve(clientDirectory, '../node_modules/material-symbols/material-symbols-outlined.woff2')
const outputPath = path.resolve(clientDirectory, 'src/assets/material-symbols-outlined-subset.woff2')
const source = await fs.readFile(sourcePath)
const font = createFont(source)
const characters = new Set([...symbols.join('')])
const knownSymbols = new Set(symbols)

async function* sourceFiles(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      yield* sourceFiles(entryPath)
    } else if (/\.[jt]sx?$/.test(entry.name)) {
      yield entryPath
    }
  }
}

for await (const sourceFile of sourceFiles(path.resolve(clientDirectory, 'src'))) {
  const contents = await fs.readFile(sourceFile, 'utf8')
  const staticallyReferencedSymbols = [
    ...contents.matchAll(/\bms\(\s*['"]([a-z0-9_]+)['"]/g),
    ...contents.matchAll(/\bsymbol\s*=\s*['"]([a-z0-9_]+)['"]/g),
  ]
  for (const match of staticallyReferencedSymbols) {
    if (!knownSymbols.has(match[1])) {
      throw new Error(`Material symbol "${match[1]}" in ${path.relative(clientDirectory, sourceFile)} is not subsetted`)
    }
  }
}

for (const symbol of symbols) {
  const glyphs = font.layout(symbol).glyphs
  if (glyphs.length !== 1) {
    throw new Error(`Material symbol "${symbol}" did not resolve to one ligature glyph`)
  }

  const glyphId = glyphs[0].id
  const codePoint = font.characterSet.find(
    (candidate) => candidate >= 0xe000 && font.glyphForCodePoint(candidate).id === glyphId,
  )
  if (codePoint === undefined) {
    throw new Error(`Material symbol "${symbol}" has no private-use code point`)
  }
  characters.add(String.fromCodePoint(codePoint))
}

const subset = await subsetFont(source, [...characters].join(''), {
  targetFormat: 'woff2',
  noLayoutClosure: true,
  variationAxes: {
    FILL: { min: 0, max: 1, default: 0 },
    GRAD: 0,
    opsz: 24,
    wght: { min: 100, max: 700, default: 400 },
  },
})
const subsetFontInstance = createFont(subset)

for (const symbol of symbols) {
  if (subsetFontInstance.layout(symbol).glyphs.length !== 1) {
    throw new Error(`Subset font does not preserve the "${symbol}" ligature`)
  }
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, subset)
console.log(`Generated ${path.relative(clientDirectory, outputPath)} (${Math.ceil(subset.length / 1024)} KiB)`)
