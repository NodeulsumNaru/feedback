// Workers use their native Queue binding. Do not bundle Vercel's Node SDK.
export async function send(): Promise<never> { throw new Error('Vercel Queues are unavailable on Workers') }
export function handleCallback() { throw new Error('Vercel callbacks are unavailable on Workers') }
