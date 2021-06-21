import { encode } from 'blurhash'

export async function blurhashFromImage(
  imageUrl: string
): Promise<string> {
  const image = await loadImage(imageUrl)
  const imageData = getImageData(image)
  return encode(
    imageData.data,
    imageData.width,
    imageData.height,
    4,
    4
  )
}

async function loadImage(
  imageUrl: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (...args) => reject(args)
    img.src = imageUrl
  })
}
function getImageData(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height

  const context = canvas.getContext('2d')!
  context.drawImage(image, 0, 0)
  return context.getImageData(
    0,
    0,
    image.width,
    image.height
  )
}
