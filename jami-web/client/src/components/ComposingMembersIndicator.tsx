/*
 * Copyright (C) 2022-2024 Savoir-faire Linux Inc.
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

import { Box, Fade, Stack, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useConversationContext } from '../contexts/ConversationProvider.js'
import { ConversationMember } from '../models/conversation-member.js'
import { translateEnumeration, TranslateEnumerationOptions } from '../utils/translations.js'

const SingleDot = ({ delay }: { delay: number }) => (
  <Box
    component={motion.div}
    animate={{ scale: [0.75, 1, 0.75] }}
    transition={{
      delay,
      duration: 0.5,
      repeatDelay: 1,
      repeatType: 'loop',
      repeat: Infinity,
      ease: 'easeInOut',
    }}
    sx={{
      width: '8px',
      height: '8px',
      borderRadius: '100%',
      backgroundColor: '#000000',
    }}
  />
)

const WaitingDots = () => {
  return (
    <Stack direction="row" spacing="5px">
      <SingleDot delay={0} />
      <SingleDot delay={0.5} />
      <SingleDot delay={1} />
    </Stack>
  )
}

export const ComposingMembersIndicator = () => {
  const { t } = useTranslation()
  const { composingMembers } = useConversationContext()

  const text = useMemo(() => {
    const options: TranslateEnumerationOptions<ConversationMember> = {
      elementPartialKey: 'member',
      getElementValue: (member) => member.getDisplayName(),
      translaters: [
        () => '',
        (interpolations) => t('are_composing_1', interpolations),
        (interpolations) => t('are_composing_2', interpolations),
        (interpolations) => t('are_composing_3', interpolations),
        (interpolations) => t('are_composing_more', interpolations),
      ],
    }

    return translateEnumeration<ConversationMember>(composingMembers, options)
  }, [composingMembers, t])

  return (
    <Stack
      sx={{
        height: '30px',
        padding: '0 16px',
        justifyContent: 'center',
      }}
    >
      <Fade in={composingMembers.length !== 0}>
        <Stack
          direction="row"
          spacing="8.5px"
          sx={[
            {
              alignItems: 'center',
            },
            (theme: any) => ({
              height: theme.typography.caption.lineHeight,
            }),
          ]}
        >
          <WaitingDots />
          <Typography variant="caption">{text}</Typography>
        </Stack>
      </Fade>
    </Stack>
  )
}

export default ComposingMembersIndicator
