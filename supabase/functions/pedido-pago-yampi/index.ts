import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const MELHOR_ENVIO_TOKEN = Deno.env.get("MELHOR_ENVIO_TOKEN_SANDBOX");
    const body = await req.json();

    const resource = body.resource;
    const customer = resource.customer?.data;
    const shipping = resource.shipping_address?.data;
    const items = resource.items?.data ?? [];
    const transaction = resource.transactions?.data?.[0];
    const spreadsheetPayment = resource.spreadsheet?.data?.[0]?.payment ?? null;

    // ==========================================================
    // 0️⃣ DELETAR DA LISTA DE ESPERA PIX (SE FOR PIX)
    // ==========================================================
    const isPix = transaction?.payment?.data?.is_pix === true;

    if (isPix) {
      const { data: listaEsperaPix, error: listaEsperaPixErro } = await supabase
        .from("lista_espera_pix")
        .select("*")
        .eq("id_yampi", resource.number);

      if (listaEsperaPixErro) {
        throw listaEsperaPixErro;
      }

      // Se existir na lista de espera pix, deletar
      if (listaEsperaPix && listaEsperaPix.length > 0) {
        const { error: deletarPixErro } = await supabase
          .from("lista_espera_pix")
          .delete()
          .eq("id_yampi", resource.number);

        if (deletarPixErro) {
          throw deletarPixErro;
        }
      }
    }

    // ==========================================================
    // 1️⃣ VERIFICAÇÃO DE UPSELL
    // ==========================================================
    const pedidoUpsell = resource.is_upsell === true;
    const cpfCliente = customer?.cpf;

    if (pedidoUpsell && cpfCliente) {
      console.log("UPSÊLL DETECTADO — procurando pedido original...");

      // Buscar cliente mais recente pelo CPF
      const { data: clienteExistente } = await supabase
        .from("clientes")
        .select("pedido_id")
        .eq("cpf", cpfCliente)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (clienteExistente?.pedido_id) {
        const pedidoOriginalId = clienteExistente.pedido_id;

        console.log("Pedido original encontrado:", pedidoOriginalId);

        // Inserir os novos itens nesse pedido
        for (const item of items) {
          const sku = item.item_sku;
          const qnt = item.quantity ?? 1;
          const precoUnit = item.price ?? 0;

          const { data: produto } = await supabase
            .from("produtos")
            .select("id, codigo_barras")
            .eq("sku", sku)
            .maybeSingle();

          const { data: variacao } = await supabase
            .from("variacoes_produto")
            .select("id, produto_id, codigo_barras_v")
            .eq("sku", sku)
            .maybeSingle();

          const inserts = [];
          for (let i = 0; i < qnt; i++) {
            inserts.push({
              pedido_id: pedidoOriginalId,
              produto_id: variacao?.produto_id ?? produto?.id ?? null,
              variacao_id: variacao?.id ?? null,
              quantidade: 1,
              preco_unitario: precoUnit,
              codigo_barras:
                variacao?.codigo_barras_v ??
                produto?.codigo_barras ??
                null,
            });
          }

          await supabase.from("itens_pedido").insert(inserts);
        }

        return new Response(
          JSON.stringify({
            message: "Upsell anexado ao pedido existente",
            pedido_id: pedidoOriginalId,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // ==========================================================
    // 1️⃣ Forma de pagamento
    // ==========================================================
    let pagamentoTexto = "Desconhecido";
    if (spreadsheetPayment) pagamentoTexto = spreadsheetPayment;
    else if (transaction?.payment?.data) {
      const pay = transaction.payment.data;
      if (pay.is_credit_card) pagamentoTexto = "Cartão de crédito";
      else if (pay.is_billet) pagamentoTexto = "Boleto";
      else if (pay.is_pix) pagamentoTexto = "Pix";
      else pagamentoTexto = pay.name ?? "Desconhecido";
    }

    const paymentId = transaction?.payment?.data?.id ?? null;
    const valorProdutos = resource.value_products ?? 0;
    const valorFreteYampi = resource.value_shipment ?? 0;
    const valorTotal = valorProdutos + valorFreteYampi;

    // ==========================================================
    // 2️⃣ Calcular embalagem
    // ==========================================================
    let totalPeso = 0;
    let maiorAltura = 0;
    let maiorLargura = 0;
    let somaComprimentos = 0;

    for (const item of items) {
      const sku = item.item_sku;
      const qnt = item.quantity ?? 1;

      const { data: produto } = await supabase
        .from("produtos")
        .select(
          `nome, embalgens_id,
           embalagens:embalgens_id (altura, largura, comprimento, peso)`
        )
        .eq("sku", sku)
        .maybeSingle();

      const emb = produto?.embalagens;
      if (emb) {
        totalPeso += Number(emb.peso) * qnt;
        maiorAltura = Math.max(maiorAltura, emb.altura);
        maiorLargura = Math.max(maiorLargura, emb.largura);
        somaComprimentos += emb.comprimento * qnt;
      }
    }

    const embalagemRow = {
      nome: "CAIXA PADRÃO",
      altura: maiorAltura || 18,
      largura: maiorLargura || 30,
      comprimento: somaComprimentos || 30,
      peso: totalPeso || 2,
    };

    // ==========================================================
    // 3️⃣ Remetente
    // ==========================================================
    const { data: remetenteData, error: remetenteError } = await supabase
      .from("remetentes")
      .select("id, nome, cep, email, contato, cidade, estado, endereco")
      .eq("id", "128a7de7-d649-43e1-8ba3-2b54c3496b14")
      .single();

    const remetente = remetenteError || !remetenteData
      ? {
          nome: "Zeelux",
          cep: "18760-390",
          email: "zeeluxbrasil@gmail.com",
          contato: "14997425154",
          cidade: "Cerqueira César",
          estado: "SP",
        }
      : remetenteData;

    const origem = {
      postal_code: remetente.cep.replace(/\D/g, ""),
      contact: remetente.nome,
      email: remetente.email,
    };

    // ==========================================================
    // 4️⃣ Cotação Melhor Envio
    // ==========================================================
    let freteMelhorEnvio = null;

    if (MELHOR_ENVIO_TOKEN && shipping?.zipcode) {
      const products = [
        {
          height: embalagemRow.altura,
          width: embalagemRow.largura,
          length: embalagemRow.comprimento,
          weight: Number(embalagemRow.peso),
          insurance_value: valorProdutos > 0 ? valorProdutos : 1,
          quantity: 1,
        },
      ];

      const to = {
        postal_code: shipping.zipcode.replace(/\D/g, ""),
      };

      const freteResponse = await fetch(
        "https://melhorenvio.com.br/api/v2/me/shipment/calculate",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: origem, to, products }),
        }
      );

      const freteJson = await freteResponse.json().catch(async () => {
        const txt = await freteResponse.text();
        console.error("Erro lendo JSON:", txt);
      });

      if (freteResponse.ok && Array.isArray(freteJson)) {
        const maisBarato = freteJson
          .filter((c) => c && (c.price || c.price_total))
          .sort(
            (a, b) =>
              Number(a.price ?? a.price_total) -
              Number(b.price ?? b.price_total)
          )[0];

        if (maisBarato) {
          freteMelhorEnvio = {
            modalidade: maisBarato.name,
            prazo: maisBarato.delivery_time ?? null,
            preco: Number(maisBarato.price ?? maisBarato.price_total ?? 0),
            service_id: maisBarato.id ?? null,
            raw_response: maisBarato,
          };
        }
      }
    }

    // ==========================================================
    // 5️⃣ Inserir pedido
    // ==========================================================
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .insert([
        {
          id_externo: resource.number?.toString(),
          cliente_nome: customer?.name,
          contato: customer?.phone?.full_number,
          responsavel_id: "c569008c-f2f0-41a8-857e-109652a98ed3",
          status_id: "3ca23a64-cb1e-480c-8efa-0468ebc18097",
          plataforma_id: "e173527c-0bad-4bb2-9add-71a7f184b364",
          pagamento: pagamentoTexto,
          id_pagamento: paymentId,
          valor_frete_yampi: valorFreteYampi,
          valor_yampi: valorProdutos,
          valor_total: valorTotal,
          frete_melhor_envio: freteMelhorEnvio,
          empresa_id: 1,
        },
      ])
      .select("id")
      .single();

    if (pedidoError)
      throw new Error("Erro ao inserir pedido: " + pedidoError.message);

    // ==========================================================
    // 6️⃣ Inserir cliente
    // ==========================================================
    await supabase.from("clientes").insert([
      {
        nome: customer?.name,
        email: customer?.email,
        cpf: customer?.cpf,
        cnpj: customer?.cnpj,
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
      },
    ]);

    // ==========================================================
    // 7️⃣ Inserir itens (um por unidade)
    // ==========================================================
    for (const item of items) {
      const sku = item.item_sku;
      const qnt = item.quantity ?? 1;
      const precoUnit = item.price ?? 0;

      const { data: produto } = await supabase
        .from("produtos")
        .select("id, codigo_barras")
        .eq("sku", sku)
        .maybeSingle();

      const { data: variacao } = await supabase
        .from("variacoes_produto")
        .select("id, produto_id, codigo_barras_v")
        .eq("sku", sku)
        .maybeSingle();

      const inserts = [];
      for (let i = 0; i < qnt; i++) {
        inserts.push({
          pedido_id: pedido.id,
          produto_id: variacao?.produto_id ?? produto?.id ?? null,
          variacao_id: variacao?.id ?? null,
          quantidade: 1,
          preco_unitario: precoUnit,
          codigo_barras:
            variacao?.codigo_barras_v ?? produto?.codigo_barras ?? null,
        });
      }

      await supabase.from("itens_pedido").insert(inserts);
    }

    // ==========================================================
    // RESPOSTA FINAL
    // ==========================================================
    return new Response(
      JSON.stringify({
        message: "Pedido e itens inseridos com sucesso",
        pedido_id: pedido.id,
        frete_sugerido: freteMelhorEnvio ?? null,
        embalagem_usada: embalagemRow,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("Erro no webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
