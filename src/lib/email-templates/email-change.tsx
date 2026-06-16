import * as React from 'react'
import { Text } from '@react-email/components'
import { YeketiEmailLayout } from './_layout'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <YeketiEmailLayout
    preview="Bevestig de wijziging van je e-mailadres"
    eyebrow="E-mailadres wijzigen"
    headline="Bevestig je nieuwe e-mailadres"
    cta={{ label: 'Wijziging bevestigen', url: confirmationUrl }}
    footerNote="Heb je dit niet aangevraagd? Beveilig dan direct je account."
  >
    <Text style={{ margin: 0 }}>
      Je vroeg aan om je e-mailadres te wijzigen van{' '}
      <strong>{oldEmail}</strong> naar <strong>{newEmail}</strong>. Bevestig
      de wijziging via de knop hieronder.
    </Text>
  </YeketiEmailLayout>
)

export default EmailChangeEmail
