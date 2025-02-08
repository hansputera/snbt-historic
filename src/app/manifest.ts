import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'SNBT Historic',
        short_name: 'SNBTH',
        description: 'Situs pencarian data historikal SNBT SNPMB Indonesia',
        categories: [
            'education',
            'pendidikan'
        ],
        lang: 'id',
        display: 'standalone',
        start_url: '/',
        icons: [
            {
                src: '/snpmb-logo.png',
                purpose: 'any',
                sizes: 'any',
                type: 'image/png',
            }
        ],
        orientation: 'any',
        background_color: '#FEFEFE',
        launch_handler: {
            client_mode: 'auto',
        },
    }
}