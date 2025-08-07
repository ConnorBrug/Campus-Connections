
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface NotificationEmailProps {
  subject: string;
  body: string;
  link?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export const NotificationEmail = ({
  subject,
  body,
  link,
}: NotificationEmailProps) => (
  <Html>
    <Head />
    <Preview>{subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src={`${baseUrl}/static/car-logo.png`}
          width="48"
          height="48"
          alt="Connections Logo"
          style={logo}
        />
        <Text style={paragraph}>{subject}</Text>
        <Text style={paragraph}>{body}</Text>
        {link && (
            <Section style={btnContainer}>
                <Button style={button} href={link}>
                    View Details in App
                </Button>
            </Section>
        )}
        <Hr style={hr} />
        <Text style={footer}>
          Connections - The easiest way to share rides to the airport.
        </Text>
      </Container>
    </Body>
  </Html>
);

NotificationEmail.defaultProps = {
  subject: 'A New Notification from Connections',
  body: 'You have a new update regarding your trip.',
};

export default NotificationEmail;

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
};

const logo = {
  margin: '0 auto',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
};

const btnContainer = {
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#10b981',
  borderRadius: '3px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px',
};

const hr = {
  borderColor: '#cccccc',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
};
