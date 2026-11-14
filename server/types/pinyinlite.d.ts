declare module 'pinyinlite' {
  export default function pinyin(
    text: string,
    options?: { keepUnrecognized?: boolean },
  ): string[][]
}
