// supabase/functions/yampi-cart-reminder-to-leads/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const payload = await req.json().catch(()=>null);
    if (!payload) {
      return new Response(JSON.stringify({
        error: "Body inválido"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (payload.event !== "cart.reminder") {
      return new Response(JSON.stringify({
        message: "Evento ignorado"
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const resource = payload.resource;
    const customer = resource.customer?.data;
    const spreadsheet = resource.spreadsheet?.data ?? {};
    const totalizers = resource.totalizers ?? {};
    if (!customer && !resource.tracking_data) {
      return new Response(JSON.stringify({
        error: "Payload sem dados do cliente"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const contato = customer?.phone?.full_number ?? spreadsheet.customer_phone ?? resource.tracking_data?.phone ?? null;
    const email = customer?.email ?? resource.tracking_data?.email ?? null;
    const cpf = customer?.cpf ?? null;
    const cnpj = customer?.cnpj ?? null;

    // Verificar se já existe pedido ativo (não enviado nem cancelado)
    if (cpf || cnpj) {
      const orFilterPedido = [];
      if (cpf) orFilterPedido.push(`cpf.eq.${cpf}`);
      if (cnpj) orFilterPedido.push(`cnpj.eq.${cnpj}`);

      const { data: pedidoExistente } = await supabase
        .from("vw_clientes_pedidos")
        .select("pedido_id, status_id, pedido_criado_em")
        .or(orFilterPedido.join(","))
        .not("status_id", "in", "(fa6b38ba-1d67-4bc3-821e-ab089d641a25,09ddb68a-cff3-4a69-a120-7459642cca6f)")
        .order("pedido_criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pedidoExistente) {
        return new Response(JSON.stringify({
          message: "Cliente já possui pedido ativo — ignorado"
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }

    if (cpf || email) {
      const orFilter = [];
      if (cpf) orFilter.push(`cpf.eq.${cpf}`);
      if (email) orFilter.push(`email.eq.${email}`);
      const { data: existingLead } = await supabase.from("leads").select("id").eq("tipo_de_lead_id", 2).or(orFilter.join(",")).maybeSingle();
      if (existingLead) {
        return new Response(JSON.stringify({
          message: "Lead já existe — ignorado"
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    // ***** INÍCIO DA CORREÇÃO *****
    let produtoUuid = null;
    // 1. Pega o SKU do primeiro item do carrinho
    const primeiroItemSku = resource.items?.data?.[0]?.sku?.data?.sku ?? null;
    if (primeiroItemSku) {
      // 2. Procura na sua tabela 'produtos' pelo produto com esse SKU
      const { data: produtoEncontrado, error: produtoError } = await supabase.from("produtos").select("id") // Seleciona apenas a coluna 'id' (que é o UUID)
      .eq("sku", primeiroItemSku).maybeSingle();
      if (produtoError) {
        console.error("Erro ao buscar produto por SKU:", produtoError);
      }
      // 3. Se encontrou, armazena o UUID
      if (produtoEncontrado) {
        produtoUuid = produtoEncontrado.id;
      } else {
        console.warn(`SKU '${primeiroItemSku}' do carrinho abandonado não foi encontrado na tabela 'produtos'.`);
      }
    }
    // ***** FIM DA CORREÇÃO *****
    const novoLead = {
      tipo_de_lead_id: 2,
      nome: customer?.name ?? resource.tracking_data?.name ?? spreadsheet.customer ?? null,
      cpf,
      cnpj: customer?.cnpj ?? null,
      contato,
      email: email,
      cep: spreadsheet.shipping_zip_code ?? resource.shipping?.data?.zip_code ?? null,
      logradouro: spreadsheet.shipping_street ?? resource.shipping?.data?.street ?? null,
      bairro: spreadsheet.shipping_neighborhood ?? resource.shipping?.data?.neighborhood ?? null,
      numero: spreadsheet.shipping_number ?? resource.shipping?.data?.number ?? null,
      cidade: spreadsheet.shipping_city ?? resource.shipping?.data?.city ?? null,
      complemento: spreadsheet.shipping_complement ?? resource.shipping?.data?.complement ?? null,
      uf: spreadsheet.shipping_state ?? resource.shipping?.data?.state ?? null,
      pais: "Brasil",
      valor_total: totalizers.total ?? spreadsheet.total ?? null,
      frete_yampi: totalizers.shipment ?? spreadsheet.shipment ?? null,
      produto_id: produtoUuid,
      responsavel: "c569008c-f2f0-41a8-857e-109652a98ed3",
      vendido: false,
      substituido: false,
      tag_utm: resource.utm_campaign ?? spreadsheet.utm_campaign ?? null
    };
    const { error } = await supabase.from("leads").insert(novoLead);
    if (error) {
      console.error("Erro detalhado ao inserir lead:", JSON.stringify(error, null, 2));
      throw new Error(`Erro ao inserir lead: ${error.message} (Código: ${error.code})`);
    }
    return new Response(JSON.stringify({
      message: "Lead inserido com sucesso"
    }), {
      status: 201,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Erro inesperado no processamento:", err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
