import { notFound } from 'next/navigation'

export default function EnvCheck() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <pre style={{ padding: 20 }}>
      {JSON.stringify(
        {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
          service: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
        },
        null,
        2
      )}
    </pre>
  )
}
