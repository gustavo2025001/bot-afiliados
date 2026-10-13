import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-queue-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function fromBase64(value: string) {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }

  return bytes;
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("Chave de criptografia invalida.");
  }

  return new Uint8Array(
    hex.match(/.{2}/g)!.map((part) => parseInt(part, 16)),
  );
}

async function decrypt(
  encryptedValue: string,
  environmentName: string,
) {
  const encryptionSecret =
    (Deno.env.get(environmentName) || "").trim();

  if (!encryptionSecret) {
    throw new Error(`${environmentName} nao configurada.`);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(encryptionSecret),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const packed = fromBase64(encryptedValue);

  const iv = packed.slice(0, 12);
  const encrypted = packed.slice(12);

  const clear = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encrypted,
  );

  return new TextDecoder().decode(clear);
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function instagramCaption(product: any) {
  const price = Number(product.price || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  );

  return `🔥 OFERTA ESPECIAL 🔥

🛍️ ${product.title}
💰 Por: ${price}

🔗 Link da oferta: ${product.affiliate_url}

#ofertas #promocao #achadinhos`.slice(0, 2200);
}

async function publishInstagram(
  supabase: any,
  userId: string,
  product: any,
) {
  if (!/^https:\/\//i.test(String(product.image_url || ""))) {
    throw new Error("Produto sem imagem HTTPS para Instagram.");
  }

  // Usa a MESMA credencial atual usada pela publicacao manual.
  // Cada cliente continua isolado pelo proprio user_id.
  const { data: credentials, error } = await supabase
    .from("instagram_credentials")
    .select("instagram_user_id, username, account_type, access_token, status")
    .eq("user_id", userId)
    .eq("status", "connected")
    .maybeSingle();

  if (error) throw error;

  if (!credentials || !credentials.access_token || !credentials.instagram_user_id) {
    throw new Error("Instagram nao conectado ou token atual indisponivel.");
  }

  const accessToken = String(credentials.access_token);
  const instagramUserId = String(credentials.instagram_user_id);
  // Mantem a mesma versao que ja funcionou no instagram-publish manual.
  const graphVersion = "v24.0";

  const createBody = new URLSearchParams({
    image_url: String(product.image_url),
    caption: instagramCaption(product),
    access_token: accessToken,
  });

  const createResponse = await fetch(
    `https://graph.instagram.com/${graphVersion}/${instagramUserId}/media`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: createBody.toString(),
    },
  );

  const createData = await createResponse.json().catch(() => ({}));

  if (!createResponse.ok || !createData.id) {
    throw new Error(
      createData?.error?.message ||
        createData?.message ||
        "Meta recusou a criacao da publicacao.",
    );
  }

  const creationId = String(createData.id);

  // A publicacao manual espera o Instagram terminar de processar a imagem.
  // O worker automatico agora faz exatamente a mesma coisa.
  let mediaReady = false;
  let mediaStatus = "";

  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const statusUrl = new URL(
      `https://graph.instagram.com/${graphVersion}/${creationId}`,
    );
    statusUrl.searchParams.set("fields", "status_code");
    statusUrl.searchParams.set("access_token", accessToken);

    const statusResponse = await fetch(statusUrl.toString());
    const statusData = await statusResponse.json().catch(() => ({}));

    mediaStatus = String(statusData?.status_code || "");

    if (mediaStatus === "FINISHED") {
      mediaReady = true;
      break;
    }

    if (mediaStatus === "ERROR" || mediaStatus === "EXPIRED") {
      throw new Error(
        `Instagram nao conseguiu processar a imagem. Status: ${mediaStatus}`,
      );
    }
  }

  if (!mediaReady) {
    throw new Error(
      `Instagram ainda nao terminou de processar a imagem. Status: ${mediaStatus || "IN_PROGRESS"}`,
    );
  }

  const publishBody = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const publishResponse = await fetch(
    `https://graph.instagram.com/${graphVersion}/${instagramUserId}/media_publish`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: publishBody.toString(),
    },
  );

  const publishData = await publishResponse.json().catch(() => ({}));

  if (!publishResponse.ok || !publishData.id) {
    throw new Error(
      publishData?.error?.message ||
        publishData?.message ||
        "Meta recusou a publicacao.",
    );
  }

  // So retorna sucesso depois de a Meta confirmar o media_publish com ID real.
  return {
    external_id: String(publishData.id),
    creation_id: creationId,
    username: credentials.username || null,
  };
}

async function sendWhatsApp(
  supabase: any,
  userId: string,
  product: any,
) {
  const {
    data: credentials,
    error,
  } = await supabase
    .from("whatsapp_credentials")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (
    !credentials ||
    credentials.status !== "connected"
  ) {
    throw new Error("WhatsApp nao conectado.");
  }

  let recipient = "";

  if (credentials.default_recipient_enc) {
    recipient = digits(
      await decrypt(
        credentials.default_recipient_enc,
        "WHATSAPP_TOKEN_ENCRYPTION_KEY",
      ),
    );
  }

  if (!recipient) {
    throw new Error(
      "WhatsApp sem destinatario padrao.",
    );
  }

  const accessToken = await decrypt(
    credentials.access_token_enc,
    "WHATSAPP_TOKEN_ENCRYPTION_KEY",
  );

  const graphVersion =
    credentials.graph_version ||
    Deno.env.get("META_GRAPH_VERSION") ||
    "v25.0";

  const text = `🔥 OFERTA ENCONTRADA!

${product.title}

💰 ${Number(product.price || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  )}

🛒 Confira a oferta:
${product.affiliate_url}`.slice(0, 4096);

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${credentials.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: {
          preview_url: true,
          body: text,
        },
      }),
    },
  );

  const data =
    await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "Meta recusou o envio WhatsApp.",
    );
  }

  return {
    external_id:
      data?.messages?.[0]?.id || null,

    to_last4:
      recipient.slice(-4),
  };
}

async function getDailyUsage(
  supabase: any,
  userId: string,
) {
  /*
   * Dia de uso considerando horario do Brasil.
   * Evita reset do limite baseado apenas em UTC.
   */
  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  );

  const parts = formatter.formatToParts(new Date());

  const year =
    parts.find((p) => p.type === "year")?.value;

  const month =
    parts.find((p) => p.type === "month")?.value;

  const day =
    parts.find((p) => p.type === "day")?.value;

  const today = `${year}-${month}-${day}`;

  let {
    data,
    error,
  } = await supabase
    .from("daily_usage")
    .select("shares_used")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  if (!error) {
    return {
      today,
      used: Number(data?.shares_used || 0),
      column: "shares_used",
    };
  }

  ({
    data,
    error,
  } = await supabase
    .from("daily_usage")
    .select("shares")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle());

  if (error) throw error;

  return {
    today,
    used: Number(data?.shares || 0),
    column: "shares",
  };
}

async function incrementDailyUsage(
  supabase: any,
  userId: string,
  usage: any,
) {
  const next = usage.used + 1;

  const row: any = {
    user_id: userId,
    usage_date: usage.today,
    updated_at:
      new Date().toISOString(),
  };

  row[usage.column] = next;

  const { error } = await supabase
    .from("daily_usage")
    .upsert(row, {
      onConflict: "user_id,usage_date",
    });

  if (error) throw error;

  usage.used = next;
}

async function getPlanLimit(
  supabase: any,
  userId: string,
) {
  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

  // ADMIN = ILIMITADO
  if (profile?.role === "admin") {
    return null;
  }

  const { data: subscriptions } =
    await supabase
      .from("subscriptions")
      .select(
        "plano,plan_code,status,vencimento,current_period_end,created_at",
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

  const subscription =
    subscriptions?.[0];

  if (
    !subscription ||
    !["active", "ativo"].includes(
      String(
        subscription.status || "",
      ).toLowerCase(),
    )
  ) {
    return 0;
  }

  const expiration =
    subscription.current_period_end ??
    subscription.vencimento;

  if (
    expiration &&
    new Date(expiration).getTime() <
      Date.now()
  ) {
    return 0;
  }

  const plan = String(
    subscription.plan_code ||
      subscription.plano ||
      "",
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (plan === "premium") {
    return null;
  }

  if (plan === "pro") {
    return 100;
  }

  if (
    plan === "basic" ||
    plan === "basico"
  ) {
    return 70;
  }

  return 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        success: false,
        error: "Metodo nao permitido.",
      },
      405,
    );
  }

  try {
    // ==========================================
    // SEGURANCA
    // ==========================================

    const expectedSecret =
      (
        Deno.env.get(
          "POST_QUEUE_SECRET",
        ) || ""
      ).trim();

    if (!expectedSecret) {
      return json(
        {
          success: false,
          error:
            "POST_QUEUE_SECRET nao configurado.",
        },
        500,
      );
    }

    const receivedSecret =
      (
        req.headers.get(
          "x-queue-secret",
        ) || ""
      ).trim();

    if (
      receivedSecret !== expectedSecret
    ) {
      return json(
        {
          success: false,
          error: "Nao autorizado.",
        },
        401,
      );
    }

    // ==========================================
    // SUPABASE
    // ==========================================

    const supabaseUrl =
      (
        Deno.env.get(
          "SUPABASE_URL",
        ) || ""
      ).trim();

    const serviceRole =
      (
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        ) || ""
      ).trim();

    if (!supabaseUrl || !serviceRole) {
      throw new Error(
        "Configuracao interna do Supabase ausente.",
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRole,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

    const now =
      new Date().toISOString();

    // ==========================================
    // FILA PENDENTE
    //
    // IMPORTANTE:
    // buscamos uma quantidade maior de itens.
    // Um cliente pausado NAO pode bloquear
    // clientes ativos que estejam depois dele.
    // ==========================================

    const {
      data: queueItems,
      error: queueError,
    } = await supabase
      .from("post_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("priority", {
        ascending: false,
      })
      .order("created_at", {
        ascending: true,
      })
      .limit(500);

    if (queueError) {
      throw queueError;
    }

    if (!queueItems?.length) {
      return json({
        success: true,
        processed: false,
        message:
          "Nenhum item pendente.",
      });
    }

    // ==========================================
    // PROCESSAR
    //
    // Cada queueItem conserva seu proprio
    // user_id. Nada e compartilhado entre
    // clientes.
    // ==========================================

    for (
      const queueItem of queueItems
    ) {
      const userId =
        String(queueItem.user_id || "");

      if (!userId) {
        continue;
      }

      // ========================================
      // CONFIGURACAO EXCLUSIVA DO CLIENTE
      // ========================================

      const {
        data: settings,
        error: settingsError,
      } = await supabase
        .from(
          "bot_automation_settings",
        )
        .select("*")
        .eq(
          "user_id",
          userId,
        )
        .maybeSingle();

      if (settingsError) {
        console.error(
          "CONFIG USER:",
          userId,
          settingsError,
        );
        continue;
      }

      // Cliente pausado:
      // pula SOMENTE este cliente.
      if (
        !settings ||
        settings.active !== true
      ) {
        continue;
      }

      // ========================================
      // PRODUTO TEM QUE SER DO MESMO CLIENTE
      // ========================================

      const {
        data: product,
        error: productError,
      } = await supabase
        .from("products")
        .select("*")
        .eq(
          "id",
          queueItem.product_id,
        )
        .eq(
          "user_id",
          userId,
        )
        .maybeSingle();

      if (productError) {
        console.error(
          "PRODUCT USER:",
          userId,
          productError,
        );
        continue;
      }

      if (
        !product ||
        product.active !== true
      ) {
        continue;
      }

      // ========================================
      // PLANO EXCLUSIVO DO CLIENTE
      // ========================================

      const dailyLimit =
        await getPlanLimit(
          supabase,
          userId,
        );

      if (dailyLimit === 0) {
        continue;
      }

      // ========================================
      // USO DIARIO EXCLUSIVO DO CLIENTE
      // ========================================

      const usage =
        await getDailyUsage(
          supabase,
          userId,
        );

      const channelsDone = {
        ...(queueItem.channels_done ||
          {}),
      };

      // ========================================
      // CANAIS EXCLUSIVOS DO CLIENTE
      // ========================================

      const channels: string[] = [];

      if (
        settings.use_instagram ===
        true
      ) {
        channels.push("instagram");
      }

      // WhatsApp permanece desativado (Em breve).
      // Mesmo que exista configuracao antiga no banco, este worker nao envia WhatsApp.

      // Se ESTE cliente nao escolheu canal,
      // pulamos apenas ele.
      if (!channels.length) {
        continue;
      }

      // ========================================
      // MARCAR ESTE ITEM COMO PROCESSANDO
      // ========================================

      const attempts =
        Number(
          queueItem.attempts || 0,
        ) + 1;

      const {
        error: processingError,
      } = await supabase
        .from("post_queue")
        .update({
          status: "processing",
          attempts,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", queueItem.id)
        .eq("user_id", userId)
        .eq("status", "pending");

      if (processingError) {
        throw processingError;
      }

      const errors: any[] = [];

      // ========================================
      // PUBLICAR SOMENTE NOS CANAIS
      // CONFIGURADOS POR ESTE CLIENTE
      // ========================================

      for (const channel of channels) {
        if (
          channelsDone[channel]
            ?.success === true
        ) {
          continue;
        }

        if (
          dailyLimit !== null &&
          usage.used >= dailyLimit
        ) {
          errors.push({
            channel,
            error:
              "Limite diario atingido.",
          });

          break;
        }

        try {
          let metadata: any;

          if (
            channel === "instagram"
          ) {
            metadata =
              await publishInstagram(
                supabase,
                userId,
                product,
              );
          } else {
            metadata =
              await sendWhatsApp(
                supabase,
                userId,
                product,
              );
          }

          channelsDone[channel] = {
            success: true,
            at:
              new Date()
                .toISOString(),
            ...metadata,
          };

          // Um envio com sucesso conta
          // apenas no uso DESTE cliente.
          await incrementDailyUsage(
            supabase,
            userId,
            usage,
          );

          await supabase
            .from("post_logs")
            .insert({
              user_id: userId,
              provider: channel,
              status: "success",
              response_meta: {
                mode: "automatic",
                queue_id:
                  queueItem.id,
                product_id:
                  product.id,
                ...metadata,
              },
            });
        } catch (error) {
          const message =
            errorMessage(error);

          errors.push({
            channel,
            error: message,
          });

          await supabase
            .from("post_logs")
            .insert({
              user_id: userId,
              provider: channel,
              status: "error",
              response_meta: {
                mode: "automatic",
                queue_id:
                  queueItem.id,
                product_id:
                  product.id,
                error: message,
              },
            });
        }
      }

      // ========================================
      // RESULTADO DESTE ITEM
      // ========================================

      const complete =
        channels.every(
          (channel) =>
            channelsDone[channel]
              ?.success === true,
        );

      const finalStatus =
        complete
          ? "done"
          : attempts >= 3
            ? "failed"
            : "pending";

      await supabase
        .from("post_queue")
        .update({
          status: finalStatus,

          channels_done:
            channelsDone,

          last_error:
            errors.length
              ? JSON.stringify(
                  errors,
                )
              : null,

          processed_at:
            complete
              ? new Date()
                  .toISOString()
              : null,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq("id", queueItem.id)
        .eq("user_id", userId);

      if (complete) {
        // Retira "na fila" SOMENTE
        // do produto deste cliente.
        await supabase
          .from("products")
          .update({
            queued: false,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq("id", product.id)
          .eq("user_id", userId);
      }

      // Uma execucao processa um item elegivel.
      return json({
        success: true,
        processed: complete,

        user_id:
          userId,

        queue_id:
          queueItem.id,

        product_id:
          product.id,

        status:
          finalStatus,

        channels:
          channels,

        channels_done:
          channelsDone,

        errors,

        shares_used:
          usage.used,

        daily_limit:
          dailyLimit,
      });
    }

    return json({
      success: true,
      processed: false,
      message:
        "Existem itens pendentes, mas nenhum cliente ativo e elegivel foi encontrado.",
    });
  } catch (error) {
    console.error(
      "PROCESS POST QUEUE:",
      error,
    );

    return json(
      {
        success: false,
        error:
          errorMessage(error),
      },
      500,
    );
  }
});