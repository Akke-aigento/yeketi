import * as React from 'react'
import { Text } from '@react-email/components'
import { YeketiEmailLayout } from './_layout'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <YeketiEmailLayout
    preview="Bevestig je e-mailadres voor Yeketi Motorworks"
    eyebrow="Welkom"
    headline="Bevestig je e-mailadres"
    cta={{ label: 'Bevestig e-mailadres', url: confirmationUrl }}
    footerNote="Heb je geen account aangemaakt? Dan kun je deze mail negeren."
  >
    <Text style={{ margin: '0 0 16px' }}>
      Welkom bij Yeketi Motorworks. We hebben je e-mailadres ({recipient})
      ontvangen — klik hieronder om je inschrijving af te ronden.
    </Text>
    <Text style={{ margin: 0 }}>
      Na bevestiging krijg je toegang tot je persoonlijke portaal met
      offertes, voortgang en berichten.
    </Text>
  </YeketiEmailLayout>
)

export default SignupEmail
