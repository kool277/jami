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
import { useEffect, useRef } from 'react'

interface AudioVisualProps {
  audioBuffer: AudioBuffer
  currentTime: number
}

const AudioVisual = ({ audioBuffer, currentTime }: AudioVisualProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (audioBuffer) {
      const canvas = canvasRef.current
      if (canvas === null) return
      const ctx = canvas.getContext('2d')
      const width = canvas.width
      const height = canvas.height

      const drawWaveform = () => {
        if (ctx === null) return
        ctx.clearRect(0, 0, width, height)
        const data = audioBuffer.getChannelData(0)
        const barCount = Math.floor(width / 6)
        const step = Math.ceil(data.length / barCount)
        const barWidth = 4
        const gap = 2
        const amp = height * 0.2

        const playedWidth = (width * currentTime) / audioBuffer.duration

        for (let i = 0; i < barCount; i++) {
          let min = 1.0
          let max = -1.0
          for (let j = 0; j < step; j++) {
            const datum = data[i * step + j]
            if (datum < min) min = datum
            if (datum > max) max = datum
          }
          const x = i * (barWidth + gap)
          const barHeight = Math.max(4, (max - min) * amp)

          if (ctx === null) return

          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
          drawRoundedBar(ctx, x, height / 2 - barHeight / 2, barWidth, barHeight)

          const playedBarWidth = Math.min(barWidth, Math.max(0, playedWidth - x))
          if (playedBarWidth > 0) {
            ctx.fillStyle = 'rgb(255, 255, 255)'
            drawRoundedBar(ctx, x, height / 2 - barHeight / 2, playedBarWidth, barHeight)
          }
        }
      }

      const drawRoundedBar = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
        const radius = Math.min(width / 2, 2)
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + width - radius, y)
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
        ctx.lineTo(x + width, y + height - radius)
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
        ctx.lineTo(x + radius, y + height)
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
        ctx.fill()
      }

      const resizeCanvas = () => {
        canvas.width = canvas.offsetWidth
        canvas.height = canvas.offsetHeight
        drawWaveform()
      }

      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)

      const intervalId = setInterval(drawWaveform, 16)

      return () => {
        clearInterval(intervalId)
        window.removeEventListener('resize', resizeCanvas)
      }
    }
  }, [audioBuffer, currentTime])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '40px', display: 'block' }} />
}

export default AudioVisual
