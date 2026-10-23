/** Image formats the editor can show from a file on disk (the preview inlines them). */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'] as const

export const isImagePath = (path: string): boolean => IMAGE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(`.${ext}`))
