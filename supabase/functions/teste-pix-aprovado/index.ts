import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Função auxiliar para atualizar o status do lead no Kommo
 * Se existir id_kommo, atualiza o lead existente. Caso contrário, cria um novo.
 */
async function atualizarLeadKommo(customer, shipping, orderId, items, idKommo = null) {
  try {
    const accessToken = Deno.env.get("KOMMO_ACCESS_TOKEN");
    const subdomain = Deno.env.get("KOMMO_SUBDOMAIN") || "tridicarimbos";

    if (!accessToken) {
      console.error("KOMMO_ACCESS_TOKEN não configurado");
      return;
    }

    // Se existe id_kommo, atualiza o lead existente
    if (idKommo) {
      const updateUrl = `https://${subdomain}.kommo.com/api/v4/leads/${idKommo}`;

      const updatePayload = {
        "status_id": 101213375, // Status de pagamento confirmado
      };

      const updateResponse = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error("Erro ao atualizar lead no Kommo:", errorText);
      } else {
        console.log(`Lead ${idKommo} atualizado no Kommo com sucesso (pagamento confirmado)!`);
      }
      return;
    }

    // Se não existe id_kommo, cria um novo lead (fallback)
    const url = `https://${subdomain}.kommo.com/api/v4/leads/complex`;

    const full_name = customer?.name || "Cliente Sem Nome";
    const nameParts = full_name.split(" ");
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(" ") || "";

    const rawFormatedPhone = customer?.phone?.formated_number || "";
    const cleanPhone = rawFormatedPhone.replace(/\D/g, "");
    const phoneWithPrefix = `+55${cleanPhone}`;

    const rua = shipping?.street || "";
    const numero = shipping?.number || "";
    const bairro = shipping?.neighborhood || "";
    const complemento = shipping?.complement || "";
    const cidade = shipping?.city || "";
    const estado = shipping?.state || "";

    let enderecoFormatado = `${rua}, ${numero}, ${bairro}`;
    if (complemento) {
      enderecoFormatado += ` - Complemento: ${complemento}`;
    }
    enderecoFormatado += ` - ${cidade} / ${estado}`;

    const produtoNome = items?.[0]?.product_name || items?.[0]?.sku?.data?.title || "Produto";

    const payload = [
      {
        "name": full_name,
        "price": 0,
        "responsible_user_id": 14784775,
        "status_id": 101213375,
        "pipeline_id": 13125763,
        "custom_fields_values": [
          { "field_id": 1451200, "values": [{ "value": String(orderId) }] },
          { "field_id": 1457552, "values": [{ "value": enderecoFormatado }] },
          { "field_id": 1457750, "values": [{ "value": produtoNome }] }
        ],
        "_embedded": {
          "contacts": [
            {
              "first_name": first_name,
              "last_name": last_name,
              "custom_fields_values": [
                { "field_code": "PHONE", "values": [{ "value": phoneWithPrefix, "enum_code": "WORK" }] }
              ]
            }
          ]
        }
      }
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro Kommo API ao criar novo lead:", errorText);
    } else {
      console.log("Novo lead enviado ao Kommo com sucesso!");
    }
  } catch (error) {
    console.error("Falha ao integrar com Kommo:", error);
  }
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const body = await req.json();
    const resource = body.resource;
    const customer = resource.customer?.data;
    const shipping = resource.shipping_address?.data;
    const items = resource.items?.data ?? [];
    const transaction = resource.transactions?.data?.[0];
    const spreadsheetPayment = resource.spreadsheet?.data?.[0]?.payment ?? null;

    // 0️⃣ BUSCAR ID_KOMMO ANTES DE DELETAR
    const isPix = transaction?.payment?.data?.is_pix === true;
    let idKommo = null;

    if (isPix) {
      const telefoneCliente = customer?.phone?.full_number;
      if (telefoneCliente) {
        const { data: leadPix } = await supabase
          .from("lista_espera_pix")
          .select("id_kommo, id")
          .eq("contato", telefoneCliente)
          .maybeSingle();

        if (leadPix?.id_kommo) {
          idKommo = leadPix.id_kommo;
          console.log("ID Kommo encontrado na lista_espera_pix:", idKommo);

          // Deleta usando o ID do registro encontrado
          const { error: deleteError } = await supabase
            .from("lista_espera_pix")
            .delete()
            .eq("id", leadPix.id);

          if (deleteError) {
            console.error("Erro ao deletar da lista_espera_pix:", deleteError);
          } else {
            console.log("Registro deletado com sucesso da lista_espera_pix");
          }
        }
      }
    }

    // 0️⃣-B BUSCAR E DELETAR DA lista_espera_type pelo contato do cliente
    const telefoneClienteType = customer?.phone?.full_number;
    if (telefoneClienteType) {
      const { data: leadType, error: leadTypeError } = await supabase
        .from("lista_espera_type")
        .select("id, id_kommo")
        .eq("contato", telefoneClienteType)
        .maybeSingle();

      if (leadTypeError) {
        console.error("Erro ao buscar na lista_espera_type:", leadTypeError);
      } else if (leadType) {
        console.log("Registro encontrado na lista_espera_type, id:", leadType.id);

        // Usa id_kommo da lista_espera_type se ainda não tiver
        if (!idKommo && leadType.id_kommo) {
          idKommo = leadType.id_kommo;
          console.log("ID Kommo obtido da lista_espera_type:", idKommo);
        }

        const { error: deleteTypeError } = await supabase
          .from("lista_espera_type")
          .delete()
          .eq("id", leadType.id);

        if (deleteTypeError) {
          console.error("Erro ao deletar da lista_espera_type:", deleteTypeError);
        } else {
          console.log("Registro deletado com sucesso da lista_espera_type");
        }
      }
    }

    // 1️⃣ VERIFICAÇÃO DE UPSELL
    const pedidoUpsell = resource.is_upsell === true;
    const cpfCliente = customer?.cpf;

    if (pedidoUpsell && cpfCliente) {
      const { data: clienteExistente } = await supabase
        .from("clientes")
        .select("pedido_id")
        .eq("cpf", cpfCliente)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (clienteExistente?.pedido_id) {
        const pedidoOriginalId = clienteExistente.pedido_id;

        for (const item of items) {
          const sku = item.item_sku;
          const qnt = item.quantity ?? 1;
          const precoUnit = item.price ?? 0;

          // Busca dados na tabela de variações primeiro, depois na de produtos
          const { data: variacao } = await supabase.from("variacoes_produto").select("id, produto_id, codigo_barras_v, empresa_id, altura, largura, comprimento, peso").eq("sku", sku).maybeSingle();

          let itemData = variacao;
          if (!itemData) {
            const { data: produto } = await supabase.from("produtos").select("id, codigo_barras, empresa_id, altura, largura, comprimento, peso").eq("sku", sku).maybeSingle();
            itemData = produto;
          }

          const produtoId = itemData?.produto_id ?? itemData?.id ?? null;
          const isProdutoPintado = produtoId === "1ff7aa43-d30b-4061-b8da-bfdee912dbb5";

          const inserts = [];
          for (let i = 0; i < qnt; i++) {
            inserts.push({
              pedido_id: pedidoOriginalId,
              produto_id: produtoId,
              variacao_id: variacao ? variacao.id : null,
              quantidade: 1,
              preco_unitario: precoUnit,
              codigo_barras: itemData?.codigo_barras_v ?? itemData?.codigo_barras ?? null,
              empresa_id: itemData?.empresa_id ?? 1,
              altura: itemData?.altura ?? 0,
              largura: itemData?.largura ?? 0,
              comprimento: itemData?.comprimento ?? 0,
              peso: itemData?.peso ?? 0,
              pintado: isProdutoPintado,
              veio_yampi: true
            });
          }
          if (inserts.length > 0) await supabase.from("itens_pedido").insert(inserts);
        }
        return new Response(JSON.stringify({ message: "Upsell processado" }), { status: 200 });
      }
    }

    // 2️⃣ Processamento de Pedido Normal
    let pagamentoTexto = "Desconhecido";
    if (spreadsheetPayment) pagamentoTexto = spreadsheetPayment;
    else if (transaction?.payment?.data) {
      const pay = transaction.payment.data;
      if (pay.is_credit_card) pagamentoTexto = "Cartão de crédito";
      else if (pay.is_billet) pagamentoTexto = "Boleto";
      else if (pay.is_pix) pagamentoTexto = "Pix";
      else pagamentoTexto = pay.name ?? "Desconhecido";
    }

    const valorProdutos = resource.value_products ?? 0;
    const valorFreteYampi = resource.value_shipment ?? 0;
    const valorTotal = valorProdutos + valorFreteYampi;

    // Inserir pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .insert([{
          id_externo: resource.number?.toString(),
          cliente_nome: customer?.name,
          contato: customer?.phone?.full_number,
          responsavel_id: "c569008c-f2f0-41a8-857e-109652a98ed3",
          status_id: "3ca23a64-cb1e-480c-8efa-0468ebc18097",
          plataforma_id: "e173527c-0bad-4bb2-9add-71a7f184b364",
          pagamento: pagamentoTexto,
          valor_frete_yampi: valorFreteYampi,
          valor_yampi: valorProdutos,
          valor_total: valorTotal,
          empresa_id: 1,
          id_kommo: idKommo,
      }])
      .select("id")
      .single();

    if (pedidoError) throw new Error("Erro ao inserir pedido: " + pedidoError.message);

    // Registrar no histórico de movimentações
    const { error: historicoErr } = await supabase
      .from("historico_movimentacoes")
      .insert({
        pedido_id: pedido.id,
        alteracao: `Pedido criado automaticamente via Yampi | ID Externo: ${resource.number?.toString()} | Pagamento: ${pagamentoTexto}`,
        user_id: null,
      });

    if (historicoErr) {
      console.error("❌ Erro ao registrar histórico:", historicoErr);
    } else {
      console.log("📝 Histórico registrado para o pedido:", pedido.id);
    }

    // Inserir cliente
    await supabase.from("clientes").insert([{
        nome: customer?.name,
        email: customer?.email,
        cpf: customer?.cpf,
        telefone: customer?.phone?.full_number,
        endereco: shipping?.street,
        bairro: shipping?.neighborhood,
        cidade: shipping?.city,
        estado: shipping?.state,
        numero: shipping?.number,
        cep: shipping?.zipcode,
        complemento: shipping?.complement,
        pedido_id: pedido.id,
        formulario_enviado: true,
        empresa_id: 1,
    }]);

    // Inserir itens com dados diretos de produtos/variacoes
    for (const item of items) {
      const sku = item.item_sku;
      const qnt = item.quantity ?? 1;
      const precoUnit = item.price ?? 0;

      const { data: variacao } = await supabase.from("variacoes_produto").select("id, produto_id, codigo_barras_v, empresa_id, altura, largura, comprimento, peso").eq("sku", sku).maybeSingle();

      let itemData = variacao;
      if (!itemData) {
        const { data: produto } = await supabase.from("produtos").select("id, codigo_barras, empresa_id, altura, largura, comprimento, peso").eq("sku", sku).maybeSingle();
        itemData = produto;
      }

      const produtoId = itemData?.produto_id ?? itemData?.id ?? null;
      const isProdutoPintado = produtoId === "1ff7aa43-d30b-4061-b8da-bfdee912dbb5";

      const inserts = [];
      for (let i = 0; i < qnt; i++) {
        inserts.push({
          pedido_id: pedido.id,
          produto_id: produtoId,
          variacao_id: variacao ? variacao.id : null,
          quantidade: 1,
          preco_unitario: precoUnit,
          codigo_barras: itemData?.codigo_barras_v ?? itemData?.codigo_barras ?? null,
          empresa_id: itemData?.empresa_id ?? 1,
          altura: itemData?.altura ?? 0,
          largura: itemData?.largura ?? 0,
          comprimento: itemData?.comprimento ?? 0,
          peso: itemData?.peso ?? 0,
          pintado: isProdutoPintado,
          veio_yampi: true
        });
      }
      if (inserts.length > 0) await supabase.from("itens_pedido").insert(inserts);
    }

    // Atualiza o lead no Kommo (se existir id_kommo, atualiza; senão, cria novo)
    await atualizarLeadKommo(customer, shipping, resource.number, items, idKommo);

    return new Response(JSON.stringify({ message: "Sucesso", pedido_id: pedido.id }), { status: 200 });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
});