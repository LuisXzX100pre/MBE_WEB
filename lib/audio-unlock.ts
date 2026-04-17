let memoryUnlocked = false

export function markAudioUnlocked() {
  memoryUnlocked = true

  if (typeof window !== 'undefined') {
    localStorage.setItem('mbe_audio_unlocked', 'true')
  }
}

export function isAudioUnlocked() {
  if (typeof window === 'undefined') return false

  if (memoryUnlocked) return true

  const stored = localStorage.getItem('mbe_audio_unlocked') === 'true'
  if (stored) {
    memoryUnlocked = true
    return true
  }

  return false
}

export async function unlockAudio() {
  if (typeof window === 'undefined') return false
  if (isAudioUnlocked()) return true

  try {
    const audio = new Audio('/sounds/drop-fall.mp3')
    audio.preload = 'auto'
    audio.volume = 0
    audio.muted = false

    await audio.play()
    audio.pause()
    audio.currentTime = 0

    markAudioUnlocked()
    return true
  } catch {
    return false
  }
}

export async function playUnlockedDropSound() {
  if (typeof window === 'undefined') return null
  if (!isAudioUnlocked()) return null

  try {
    const audio = new Audio('/sounds/drop-fall.mp3')
    audio.preload = 'auto'
    audio.volume = 1
    audio.currentTime = 0
    await audio.play()
    return audio
  } catch {
    return null
  }
}
