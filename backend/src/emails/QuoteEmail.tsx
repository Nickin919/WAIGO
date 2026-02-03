import * as React from 'react';
import {
  Html,
  Body,
  Container,
  Text,
  Section,
  Button,
  Tailwind,
} from '@react-email/components';

export interface QuoteEmailProps {
  customerName: string;
  quoteId: string;
  quoteNumber: string;
  quoteSummary: string;
  viewQuoteUrl: string;
}

export default function QuoteEmail({
  customerName,
  quoteId,
  quoteNumber,
  quoteSummary,
  viewQuoteUrl,
}: QuoteEmailProps) {
  return (
    <Html>
      <Tailwind>
        <Body style={{ backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
          <Container
            style={{
              backgroundColor: '#ffffff',
              padding: '24px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              maxWidth: '512px',
              margin: '32px auto',
            }}
          >
            <Text
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '16px',
                color: '#111827',
              }}
            >
              Your WAIGO Quote #{quoteNumber}
            </Text>
            <Text style={{ marginBottom: '16px', color: '#374151' }}>
              Hello {customerName},
            </Text>
            <Section style={{ marginBottom: '16px' }}>
              <Text style={{ color: '#374151' }}>{quoteSummary}</Text>
            </Section>
            <Text style={{ marginBottom: '16px', color: '#374151' }}>
              You can view the full quote online and download it as needed.
            </Text>
            <Button
              href={viewQuoteUrl}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '12px 16px',
                borderRadius: '6px',
                fontWeight: '600',
              }}
            >
              View Quote Online
            </Button>
            <Text
              style={{
                fontSize: '12px',
                color: '#6b7280',
                marginTop: '24px',
              }}
            >
              WAIGO Industrial Solutions
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
