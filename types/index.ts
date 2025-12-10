export interface Word {
    id: string
    text: string
    displayText: string
    soundEffect?: string
    soundVolume?: number
    soundDelay?: number
    mediaUrl?: string
    mediaType?: 'image' | 'video'
    isLineBreak?: boolean
}

export interface Sentence {
    id: string
    text: string
    voice: string
    speed?: number
    pitch?: number
    audioContent?: string // Base64
    words?: Word[]
    isGenerating?: boolean
}

export interface CaptionSettings {
    fontFamily: string
    fontSize: number
    isUppercase: boolean
    fontWeight: 'normal' | 'bold' | 'extra-bold'
    isItalic: boolean
    textColor: string
    hasShadow: boolean
    shadowColor: string
    shadowSize: number
    hasBackground: boolean
    paddingTop: number
    swapPosition?: boolean
}

export interface Project {
    id: string
    type: string
    title?: string
    sentences: Sentence[]
    backgroundVideo?: string
    backgroundThumbnail?: string
    captionSettings?: CaptionSettings
    createdAt: string
}

export interface TimelineItem {
    sentenceId: string
    startTime: number
    duration: number
    audioUrl: string
}
