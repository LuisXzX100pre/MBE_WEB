'use client'

import { useEffect } from 'react'
import { unlockAudio } from '@/lib/audio-unlock'

export function AudioUnlockProvider() {
  useEffect(() => {
    let unlocked = false

    const enableAudio = async () => {
      if (unlocked) return

      const success = await unlockAudio()
      if (!success) return

      unlocked = true
      window.removeEventListener('pointerdown', enableAudio)
      window.removeEventListener('touchstart', enableAudio)
      window.removeEventListener('keydown', enableAudio)
    }

    window.addEventListener('pointerdown', enableAudio, { passive: true })
    window.addEventListener('touchstart', enableAudio, { passive: true })
    window.addEventListener('keydown', enableAudio)

    return () => {
      window.removeEventListener('pointerdown', enableAudio)
      window.removeEventListener('touchstart', enableAudio)
      window.removeEventListener('keydown', enableAudio)
    }
  }, [])

  return null
}