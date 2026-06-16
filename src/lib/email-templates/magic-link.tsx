import * as React from 'react'
import { Text } from '@react-email/components'
import { YeketiEmailLayout } from './_layout'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <YeketiEmailLayout
    preview="Jouw inloglink voor het Yeketi-portaal"
    eyebrow="Inloggen"
    headline="Je inloglink"
    cta={{ label: 'Inloggen', url: confirmationUrl }}
    footerNote="Niet door jou aangevraagd? Negeer deze mail."
  >
    <Text style={{ margin: 0 }}>
      Klik op de knop hieronder om in te loggen op je Yeketi-portaal. De link
      blijft kort geldig en kan slechts één keer gebruikt worden.
    </Text>
  </YeketiEmailLayout>
)

export default MagicLinkEmail
