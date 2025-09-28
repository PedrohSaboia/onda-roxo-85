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
    const { origem, destino, pacote } = await req.json();

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
        products: pacote
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

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message }), 
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
