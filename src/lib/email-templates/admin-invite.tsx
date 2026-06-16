import * as React from 'react'
import { Text } from '@react-email/components'
import { YeketiEmailLayout } from './_layout'

interface AdminInviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const AdminInviteEmail = ({ confirmationUrl }: AdminInviteEmailProps) => (
  <YeketiEmailLayout
    preview="Je bent uitgenodigd als beheerder van Yeketi Motorworks"
    eyebrow="Admin-uitnodiging"
    headline="Toegang tot het Yeketi-beheer"
    cta={{ label: 'Beheeraccount activeren', url: confirmationUrl }}
    footerNote="Verwacht je deze uitnodiging niet? Negeer dan deze mail — er gebeurt niets met je adres."
  >
    <Text style={{ margin: '0 0 16px' }}>
      Je bent toegevoegd als beheerder van het Yeketi Motorworks-platform.
      Met je beheeraccount kun je offertes, projecten, klanten en berichten
      opvolgen vanuit het admin-paneel.
    </Text>
    <Text style={{ margin: 0 }}>
      Klik op de knop hieronder om je account te activeren en een persoonlijk
      wachtwoord in te stellen. Behandel deze toegang vertrouwelijk.
    </Text>
  </YeketiEmailLayout>
)

export default AdminInviteEmail