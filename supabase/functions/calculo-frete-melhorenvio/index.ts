// @ts-nocheck
import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
const MELHOR_ENVIO_TOKEN = Deno.env.get("MELHOR_ENVIO_TOKEN_SANDBOX");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse JSON body safely
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Request body must be valid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Accept both Portuguese and English keys (origem/from, destino/to, pacote/products, package)
    const origem = body.origem || body.from || body.remetente || null;
    const destino = body.destino || body.to || body.cliente || null;
    const pacote = body.pacote || body.products || body.package || body.produtos || null;

    // Validate token
    if (!MELHOR_ENVIO_TOKEN) {
      console.error('MELHOR_ENVIO_TOKEN_SANDBOX is not set');
      return new Response(JSON.stringify({ error: 'Melhor Envio token not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate presence of required sender fields
    if (!origem || !origem.postal_code) {
      return new Response(JSON.stringify({ error: 'Remetente precisa ter postal_code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!origem.contact || !origem.email) {
      return new Response(JSON.stringify({ error: 'Remetente precisa ter contato e email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate destination
    if (!destino || !destino.postal_code) {
      return new Response(JSON.stringify({ error: 'Destino precisa ter postal_code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Ensure products/pacote is an array (Melhor Envio expects an array of products)
    const products = Array.isArray(pacote) ? pacote : (pacote ? [pacote] : []);

    // Calcular o frete (cotação na API do Melhor Envio)
    const cotacaoResp = await fetch("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: origem,
        to: destino,
        products
      })
    });

    if (!cotacaoResp.ok) {
      let errorMessage = 'Erro ao calcular o frete';
      try {
        const errJson = await cotacaoResp.json();
        if (errJson.message) {
          errorMessage = errJson.message;
        } else if (errJson.error) {
          errorMessage = errJson.error;
        }
      } catch (e) {
        const errText = await cotacaoResp.text();
        errorMessage = errText || errorMessage;
      }
      console.error("Erro na cotação:", errorMessage);
      return new Response(
        JSON.stringify({ error: errorMessage }), 
        { 
          status: cotacaoResp.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const cotacoes = await cotacaoResp.json();
    return new Response(
      JSON.stringify({ cotacoes }), 
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }), 
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
