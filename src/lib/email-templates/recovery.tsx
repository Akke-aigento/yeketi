import * as React from 'react'
import { Text } from '@react-email/components'
import { YeketiEmailLayout } from './_layout'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <YeketiEmailLayout
    preview="Stel een nieuw wachtwoord in voor je Yeketi-portaal"
    eyebrow="Wachtwoord herstellen"
    headline="Stel een nieuw wachtwoord in"
    cta={{ label: 'Nieuw wachtwoord kiezen', url: confirmationUrl }}
    footerNote="Heb je dit niet aangevraagd? Negeer deze mail — je wachtwoord blijft ongewijzigd."
  >
    <Text style={{ margin: 0 }}>
      We ontvingen een verzoek om je wachtwoord te wijzigen. Klik op de knop
      hieronder om binnen 1 uur een nieuw wachtwoord in te stellen.
    </Text>
  </YeketiEmailLayout>
)

export default RecoveryEmail
