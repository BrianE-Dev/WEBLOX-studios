const endpoint = import.meta.env.VITE_INTERNSHIP_APPLICATION_ENDPOINT

export async function submitInternshipApplication(formData) {
  if (!endpoint) throw new Error('The application service is not configured yet.')
  const response = await fetch(endpoint, { method: 'POST', body: formData })
  if (!response.ok) throw new Error('We could not submit your application. Please try again.')
  return response.json().catch(() => ({}))
}
