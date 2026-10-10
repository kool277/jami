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
import { Box, Container } from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import Logo from '../icons/jamiLogoIcon.svg?react'

const list = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.3,
    },
  },
}
const item = {
  visible: { opacity: 1, x: 0 },
  hidden: { opacity: 0, x: 0 },
}

type WelcomeAnimationProps = {
  onComplete: () => void
}

export default function WelcomeAnimation(props: WelcomeAnimationProps) {
  const [visible, setVisible] = useState(true)

  const backgroundStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    backgroundImage: `url(./admin/background.jpg)`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    transition: 'background-image 0.5s ease-in-out',
  }

  return (
    <Box sx={backgroundStyle}>
      <Container
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex',
          width: '100%',
          height: '100%',
        }}
      >
        <AnimatePresence>
          {visible && (
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={list}
              onAnimationComplete={(a) => {
                if (a === 'hidden') {
                  props.onComplete()
                } else {
                  setVisible(false)
                }
              }}
            >
              <motion.div style={{ width: '100%', display: 'flex', justifyContent: 'center' }} variants={item}>
                <Logo width="60%" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </Box>
  )
}
