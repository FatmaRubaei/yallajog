const META_GRAPH_VERSION = "v22.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export class MetaGraphError extends Error {
  code: number | null;
  type: string | null;

  constructor(message: string, options?: { code?: number; type?: string }) {
    super(message);
    this.name = "MetaGraphError";
    this.code = options?.code ?? null;
    this.type = options?.type ?? null;
  }
}

export function getMetaAppConfig() {
  const appId = process.env["META_APP_ID"]?.trim();
  const appSecret = process.env["META_APP_SECRET"]?.trim();
  const embeddedSignupConfigId = process.env["WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID"]?.trim();
  const webhookVerifyToken = process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"]?.trim();

  return {
    appId: appId || null,
    appSecret: appSecret || null,
    embeddedSignupConfigId: embeddedSignupConfigId || null,
    webhookVerifyToken: webhookVerifyToken || null,
    onboardingReady: Boolean(appId && appSecret && embeddedSignupConfigId),
  };
}

export function normalizePhone(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly === "") {
    return null;
  }

  return `${hasPlus ? "+" : ""}${digitsOnly}`;
}

export async function readMetaGraphResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | { error?: { message?: string; type?: string; code?: number } }
    | T
    | null;

  if (!response.ok) {
    const metaError = data && typeof data === "object" && "error" in data ? data.error : null;
    const message = metaError?.message;

    throw new MetaGraphError(message || `Meta Graph request failed with status ${response.status}`, {
      code: metaError?.code,
      type: metaError?.type,
    });
  }

  return data as T;
}

export async function exchangeEmbeddedSignupCode(code: string, appId: string, appSecret: string) {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });

  const response = await fetch(`${META_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`);
  const data = await readMetaGraphResponse<{ access_token?: string }>(response);

  if (!data.access_token) {
    throw new Error("Meta did not return an access token for embedded signup.");
  }

  return data.access_token;
}

export async function fetchMetaGraphObject<T>(id: string, fields: string[], accessToken: string) {
  const params = new URLSearchParams({
    fields: fields.join(","),
    access_token: accessToken,
  });

  const response = await fetch(`${META_GRAPH_BASE_URL}/${id}?${params.toString()}`);
  return readMetaGraphResponse<T>(response);
}

export async function fetchMetaGraphEdge<T>(path: string, params: Record<string, string>, accessToken: string) {
  const searchParams = new URLSearchParams({
    ...params,
    access_token: accessToken,
  });

  const response = await fetch(`${META_GRAPH_BASE_URL}/${path}?${searchParams.toString()}`);
  return readMetaGraphResponse<T>(response);
}

export async function resolveEmbeddedSignupAccount(accessToken: string) {
  type MetaPhoneNumber = {
    id?: string;
    display_phone_number?: string;
    verified_name?: string;
  };

  type MetaWaba = {
    id?: string;
    name?: string;
    phone_numbers?: { data?: MetaPhoneNumber[] };
  };

  type MetaBusiness = {
    owned_whatsapp_business_accounts?: { data?: MetaWaba[] };
    whatsapp_business_accounts?: { data?: MetaWaba[] };
  };

  const me = await fetchMetaGraphObject<{
    businesses?: { data?: MetaBusiness[] };
  }>(
    "me",
    [
      "businesses{owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}},whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}}",
    ],
    accessToken,
  );

  const candidates: Array<{
    wabaId: string;
    phoneNumberId: string;
    businessName: string | null;
    displayPhoneNumber: string | null;
  }> = [];

  for (const business of me.businesses?.data ?? []) {
    const businessAccounts = [
      ...(business.owned_whatsapp_business_accounts?.data ?? []),
      ...(business.whatsapp_business_accounts?.data ?? []),
    ];

    for (const account of businessAccounts) {
      for (const phoneNumber of account.phone_numbers?.data ?? []) {
        if (account.id && phoneNumber.id) {
          candidates.push({
            wabaId: account.id,
            phoneNumberId: phoneNumber.id,
            businessName: account.name?.trim() || phoneNumber.verified_name?.trim() || null,
            displayPhoneNumber: phoneNumber.display_phone_number?.trim() || null,
          });
        }
      }
    }
  }

  const uniqueCandidates = candidates.filter(
    (candidate, index, list) =>
      list.findIndex(
        (entry) =>
          entry.wabaId === candidate.wabaId && entry.phoneNumberId === candidate.phoneNumberId,
      ) === index,
  );

  if (uniqueCandidates.length === 1) {
    return uniqueCandidates[0];
  }

  if (uniqueCandidates.length > 1) {
    throw new Error(
      "Meta returned multiple WhatsApp accounts or phone numbers for this signup. Retry until Meta sends the final completion details, or save the exact phone number ID manually.",
    );
  }

  throw new Error("Meta did not return a WhatsApp Business account and phone number for embedded signup.");
}

export async function resolveEmbeddedSignupAccountSelection(
  accessToken: string,
  options?: { wabaId?: string | null; phoneNumberId?: string | null },
) {
  type MetaPhoneNumber = {
    id?: string;
    display_phone_number?: string;
    verified_name?: string;
  };

  if (options?.wabaId) {
    const [waba, phoneNumbers] = await Promise.all([
      fetchMetaGraphObject<{ id?: string; name?: string }>(options.wabaId, ["id", "name"], accessToken),
      fetchMetaGraphEdge<{ data?: MetaPhoneNumber[] }>(
        `${options.wabaId}/phone_numbers`,
        {
          fields: "id,display_phone_number,verified_name",
        },
        accessToken,
      ),
    ]);

    const candidates = (phoneNumbers.data ?? []).filter(
      (phoneNumber): phoneNumber is Required<Pick<MetaPhoneNumber, "id">> & MetaPhoneNumber =>
        Boolean(phoneNumber.id),
    );

    if (options.phoneNumberId) {
      const exactMatch = candidates.find((phoneNumber) => phoneNumber.id === options.phoneNumberId);
      if (exactMatch) {
        return {
          wabaId: options.wabaId,
          phoneNumberId: exactMatch.id,
          businessName: waba.name?.trim() || exactMatch.verified_name?.trim() || null,
          displayPhoneNumber: exactMatch.display_phone_number?.trim() || null,
        };
      }
    }

    if (candidates.length === 1) {
      const [phoneNumber] = candidates;

      return {
        wabaId: options.wabaId,
        phoneNumberId: phoneNumber.id,
        businessName: waba.name?.trim() || phoneNumber.verified_name?.trim() || null,
        displayPhoneNumber: phoneNumber.display_phone_number?.trim() || null,
      };
    }
  }

  return resolveEmbeddedSignupAccount(accessToken);
}

export async function subscribeEmbeddedSignupApp(wabaId: string, accessToken: string) {
  const body = new URLSearchParams({
    access_token: accessToken,
  });

  const response = await fetch(`${META_GRAPH_BASE_URL}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await readMetaGraphResponse<{ success?: boolean }>(response);
  return Boolean(data.success);
}

export async function registerWhatsAppPhoneNumber(phoneNumberId: string, accessToken: string) {
  const response = await fetch(`${META_GRAPH_BASE_URL}/${phoneNumberId}/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      pin: "000000",
    }),
  });

  const data = await readMetaGraphResponse<{ success?: boolean }>(response);
  return Boolean(data.success);
}

export async function uploadWhatsAppMedia(options: {
  accessToken: string;
  phoneNumberId: string;
  fileBuffer: Buffer;
  mimeType: string;
  filename: string;
}) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append(
    "file",
    new Blob([options.fileBuffer], { type: options.mimeType }),
    options.filename,
  );

  const response = await fetch(
    `${META_GRAPH_BASE_URL}/${options.phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${options.accessToken}` },
      body: form,
    },
  );

  return readMetaGraphResponse<{ id?: string }>(response);
}

export async function sendWhatsAppDocumentMessage(options: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  mediaId: string;
  filename: string;
  caption?: string;
}) {
  const response = await fetch(
    `${META_GRAPH_BASE_URL}/${options.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: options.to.replace(/^\+/, ""),
        type: "document",
        document: {
          id: options.mediaId,
          filename: options.filename,
          ...(options.caption ? { caption: options.caption } : {}),
        },
      }),
    },
  );

  return readMetaGraphResponse<{
    messaging_product?: string;
    contacts?: Array<{ input?: string; wa_id?: string }>;
    messages?: Array<{ id?: string }>;
  }>(response);
}

export async function sendWhatsAppTextMessage(options: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
}) {
  const response = await fetch(`${META_GRAPH_BASE_URL}/${options.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: options.to.replace(/^\+/, ""),
      type: "text",
      text: {
        preview_url: false,
        body: options.text,
      },
    }),
  });

  return readMetaGraphResponse<{
    messaging_product?: string;
    contacts?: Array<{ input?: string; wa_id?: string }>;
    messages?: Array<{ id?: string }>;
  }>(response);
}
