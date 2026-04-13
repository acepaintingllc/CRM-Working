import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ACE Field Cam',
    short_name: 'ACE Cam',
    description: 'Mobile-first field camera for ACE Painting jobs.',
    start_url: '/field/jobs',
    display: 'standalone',
    background_color: '#d7efe5',
    theme_color: '#16a34a',
    orientation: 'portrait',
    icons: [
      {
        src: '/ace-logo-clean.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/ace-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
