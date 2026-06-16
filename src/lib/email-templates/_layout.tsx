import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// Yeketi brand palette — mirrors supabase/functions/_shared/email-template.ts
export const palette = {
  page: '#F7F3EC',
  card: '#FFFFFF',
  charcoal: '#221F1B',
  body: '#4A453E',
  brass: '#B0832C',
  hair: '#EFE8DB',
}

type LayoutProps = {
  preview: string
  eyebrow?: string
  headline: string
  children: React.ReactNode
  cta?: { label: string; url: string }
  footerNote?: string
}

const serif = "Georgia,'Times New Roman',serif"
const sans = 'Arial,Helvetica,sans-serif'

export function YeketiEmailLayout({
  preview,
  eyebrow,
  headline,
  children,
  cta,
  footerNote,
}: LayoutProps) {
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#ffffff',
          margin: 0,
          padding: 0,
          fontFamily: sans,
        }}
      >
        <Section style={{ backgroundColor: palette.page, padding: '36px 0 0' }}>
          <Container style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
            <Text
              style={{
                fontFamily: serif,
                color: palette.brass,
                fontSize: 22,
                lineHeight: 1,
                margin: 0,
              }}
            >
              ☼
            </Text>
            <Text
              style={{
                fontFamily: serif,
                color: palette.charcoal,
                fontSize: 22,
                lineHeight: 1.2,
                letterSpacing: '0.32em',
                margin: '10px 0 6px',
              }}
            >
              YEKETI
            </Text>
            <Text
              style={{
                fontFamily: sans,
                color: palette.brass,
                fontSize: 10,
                lineHeight: 1,
                letterSpacing: '0.42em',
                textTransform: 'uppercase',
                margin: '0 0 28px',
              }}
            >
              Motorworks
            </Text>
          </Container>
        </Section>
        <Section style={{ backgroundColor: palette.page, padding: '0 0 40px' }}>
          <Container
            style={{
              maxWidth: 600,
              margin: '0 auto',
              backgroundColor: palette.card,
              padding: '40px 36px',
              border: `1px solid ${palette.hair}`,
            }}
          >
            {eyebrow && (
              <Text
                style={{
                  fontFamily: sans,
                  fontSize: 11,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: palette.brass,
                  margin: '0 0 14px',
                }}
              >
                {eyebrow}
              </Text>
            )}
            <Heading
              as="h1"
              style={{
                fontFamily: serif,
                fontSize: 26,
                lineHeight: 1.25,
                color: palette.charcoal,
                fontWeight: 400,
                margin: '0 0 20px',
              }}
            >
              {headline}
            </Heading>
            <div
              style={{
                fontFamily: sans,
                fontSize: 15,
                lineHeight: 1.7,
                color: palette.body,
              }}
            >
              {children}
            </div>
            {cta && (
              <Section style={{ textAlign: 'center', padding: '28px 0 4px' }}>
                <Button
                  href={cta.url}
                  style={{
                    backgroundColor: palette.brass,
                    color: '#ffffff',
                    border: `1px solid ${palette.charcoal}`,
                    padding: '14px 30px',
                    fontFamily: sans,
                    fontSize: 12,
                    fontWeight: 'bold',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                  }}
                >
                  {cta.label}
                </Button>
              </Section>
            )}
            {footerNote && (
              <>
                <Hr style={{ borderColor: palette.hair, margin: '32px 0 18px' }} />
                <Text
                  style={{
                    fontFamily: sans,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: '#8a8378',
                    margin: 0,
                  }}
                >
                  {footerNote}
                </Text>
              </>
            )}
          </Container>
          <Container style={{ maxWidth: 600, margin: '0 auto', padding: '20px 36px 0' }}>
            <Text
              style={{
                fontFamily: sans,
                fontSize: 11,
                lineHeight: 1.6,
                color: '#8a8378',
                textAlign: 'center',
                margin: 0,
              }}
            >
              Yeketi Motorworks · Vredeplein 23, 3010 Kessel-Lo ·{' '}
              info@yeketimotorworks.com · yeketimotorworks.com
            </Text>
          </Container>
        </Section>
      </Body>
    </Html>
  )
}