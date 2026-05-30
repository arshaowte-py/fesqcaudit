function isGraphMailConfigured() {
  return Boolean(
    process.env.AZURE_TENANT_ID &&
      process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET &&
      process.env.GRAPH_SENDER_UPN
  );
}

async function getGraphAccessToken() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error_description || data.error || 'Failed to obtain Graph access token'
    );
  }
  return data.access_token;
}

function toRecipients(addresses) {
  return addresses.map((address) => ({
    emailAddress: { address },
  }));
}

/**
 * Send HTML mail via Microsoft Graph (application Mail.Send).
 */
export async function sendGraphMail({ to, cc = [], subject, html }) {
  if (!isGraphMailConfigured()) {
    return { sent: false, reason: 'Graph mail env vars not configured' };
  }

  if (!to?.length) {
    return { sent: false, reason: 'No recipients' };
  }

  const token = await getGraphAccessToken();
  const sender = process.env.GRAPH_SENDER_UPN;

  const message = {
    subject,
    body: {
      contentType: 'HTML',
      content: html,
    },
    toRecipients: toRecipients(to),
  };

  if (cc.length) {
    message.ccRecipients = toRecipients(cc);
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    }
  );

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.error?.message || JSON.stringify(err);
    } catch {
      /* ignore */
    }
    throw new Error(`Graph sendMail failed: ${detail}`);
  }

  return { sent: true };
}

export { isGraphMailConfigured };
