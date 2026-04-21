import { redirect } from 'next/navigation'

export default function NewEstimateRedirectPage() {
  redirect('/crm/quotes/create')
}
