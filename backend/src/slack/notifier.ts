// src/slack/notifier.ts
import { IncomingWebhook } from '@slack/webhook';
import { prisma } from '../app';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Sends a Slack alert to the webhook URL stored for the given tenant/sender.
 * If no webhook is configured, the function silently returns.
 */
export async function sendSlackAlert(senderId: string, message: string) {
  // Assuming a table SlackIntegration with columns: senderId (string), webhookUrl (string)
  const integration = await prisma.slackIntegration.findUnique({
    where: { senderId },
  });
  if (!integration?.webhookUrl) return;

  const webhook = new IncomingWebhook(integration.webhookUrl);
  await webhook.send({
    text: message,
  });
}
