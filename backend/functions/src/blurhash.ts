import { read, MIME_JPEG } from 'jimp'
import { encode } from 'blurhash'

export async function blurhashFromImage(
  imageUrl: string
): Promise<string> {
  const jimp = await read(imageUrl)
  jimp.resize(32, 32).opaque()

  const hash = encode(
    new Uint8ClampedArray(
      await jimp.getBufferAsync(MIME_JPEG)
    ),
    jimp.getWidth(),
    jimp.getHeight(),
    4,
    4
  )
  return hash
}
