import * as React from 'react'
import { Text } from '@react-email/components'
import { YeketiEmailLayout } from './_layout'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <YeketiEmailLayout
    preview="Je bent uitgenodigd voor het Yeketi-portaal"
    eyebrow="Uitnodiging"
    headline="Je bent uitgenodigd"
    cta={{ label: 'Uitnodiging accepteren', url: confirmationUrl }}
    footerNote="Verwacht je deze uitnodiging niet? Negeer dan deze mail."
  >
    <Text style={{ margin: '0 0 16px' }}>
      Yeketi Motorworks heeft een persoonlijk portaal voor je aangemaakt.
      Daar volg je jouw project, offertes en berichten op één plek.
    </Text>
    <Text style={{ margin: 0 }}>
      Klik op de knop hieronder om je account te activeren en een wachtwoord
      in te stellen.
    </Text>
  </YeketiEmailLayout>
)

export default InviteEmail
