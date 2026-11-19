import { Box, Text } from '@mantine/core'
import { IconTrophy } from '@tabler/icons-react'
import type { CSSProperties } from 'react'

const palettes = [
  ['#0f766e', '#2dd4bf'],
  ['#1e3a8a', '#60a5fa'],
  ['#7c2d12', '#fb923c'],
  ['#4c1d95', '#a78bfa'],
  ['#831843', '#f472b6'],
  ['#134e4a', '#34d399'],
]

export function EventCover({
  id,
  name,
  height = 160,
  radius = 'md',
}: {
  id: number
  name: string
  height?: number
  radius?: string
}) {
  const [from, to] = palettes[id % palettes.length]
  return (
    <Box
      className="event-cover"
      style={
        {
          height,
          borderRadius: radius,
          position: 'relative',
          overflow: 'hidden',
          '--cover-from': from,
          '--cover-to': to,
        } as CSSProperties
      }
    >
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(15,23,42,0) 20%, rgba(15,23,42,0.55) 100%)',
        }}
      />
      <IconTrophy
        size={height * 0.8}
        stroke={1.2}
        color="rgba(255,255,255,0.18)"
        style={{ position: 'absolute', right: -12, bottom: -18 }}
      />
      <Text
        c="white"
        fw={700}
        fz={height > 120 ? 'lg' : 'md'}
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 14,
          textShadow: '0 2px 12px rgba(0,0,0,0.35)',
        }}
        lineClamp={2}
      >
        {name}
      </Text>
    </Box>
  )
}
