import * as React from 'react'
import { Text } from '@react-email/components'
import { YeketiEmailLayout, palette } from './_layout'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <YeketiEmailLayout
    preview="Je verificatiecode voor Yeketi Motorworks"
    eyebrow="Verificatie"
    headline="Je verificatiecode"
    footerNote="Heb je dit niet aangevraagd? Negeer deze mail."
  >
    <Text style={{ margin: '0 0 18px' }}>
      Gebruik onderstaande code om je identiteit te bevestigen. De code is
      kort geldig.
    </Text>
    <Text
      style={{
        fontFamily: "Georgia,'Times New Roman',serif",
        fontSize: 32,
        letterSpacing: '0.4em',
        color: palette.charcoal,
        textAlign: 'center',
        margin: '20px 0',
        padding: '18px 0',
        backgroundColor: palette.page,
        border: `1px solid ${palette.hair}`,
      }}
    >
      {token}
    </Text>
  </YeketiEmailLayout>
)

export default ReauthenticationEmail
