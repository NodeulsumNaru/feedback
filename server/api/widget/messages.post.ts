export default defineEventHandler(() => {
  throw createError({ statusCode: 410, message: 'Refresh the widget to start an Agent conversation', data: { code: 'upgrade_required' } })
})
