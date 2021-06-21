import { read } from 'jimp'
import { encode } from 'blurhash'

export async function blurhashFromImage(
  imageUrl: string
): Promise<string> {
  const jimp = await read(imageUrl)
  jimp.resize(32, 32).opaque()

  const hash = encode(
    new Uint8ClampedArray(jimp.bitmap.data),
    jimp.getWidth(),
    jimp.getHeight(),
    4,
    4
  )
  return hash
}
