import sharp = require('sharp')
import { encode } from 'blurhash'

export async function blurhashFromImage(
  imageUrl: string
): Promise<string> {
  const result = await sharp(imageUrl)
    .raw()
    .ensureAlpha()
    .resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true })

  const hash = encode(
    new Uint8ClampedArray(result.data),
    result.info.width,
    result.info.height,
    4,
    4
  )
  return hash
}
