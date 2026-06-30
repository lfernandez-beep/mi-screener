// netlify/functions/target.js
// Mini-programa que va a Yahoo Finance, saca el target price, y lo devuelve

exports.handler = async (event) => {
  const ticker = (event.queryStringParameters?.ticker || '').toUpperCase().trim();

  // Headers de CORS — permiten que cualquier sitio (incluyendo el tuyo) llame esta función
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Si es una petición OPTIONS (preflight de CORS), devolver OK
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!ticker) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Falta el parámetro ticker. Usá: ?ticker=AAPL' })
    };
  }

  // User-Agent de navegador real — Yahoo bloquea bots sin UA válido
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    // Paso 1: pedirle a Yahoo una cookie de sesión
    const cookieRes = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': UA }
    });
    const setCookie = cookieRes.headers.get('set-cookie') || '';

    // Paso 2: pedir el "crumb" — un token anti-bot que Yahoo exige
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': setCookie }
    });
    const crumb = (await crumbRes.text()).trim();

    if (!crumb || crumb.length < 5 || crumb.includes('<')) {
      throw new Error('No se pudo obtener el crumb de Yahoo');
    }

    // Paso 3: pedir el target price usando la cookie y el crumb
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=financialData&crumb=${encodeURIComponent(crumb)}`;
    const dataRes = await fetch(url, {
      headers: { 'User-Agent': UA, 'Cookie': setCookie }
    });

    if (!dataRes.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ticker, target: null, source: 'yahoo', error: `HTTP ${dataRes.status}` })
      };
    }

    const data = await dataRes.json();
    const fd = data?.quoteSummary?.result?.[0]?.financialData;

    if (!fd) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ticker, target: null, source: 'yahoo', error: 'No data' })
      };
    }

    // Yahoo a veces devuelve {raw: 123.45, fmt: "123.45"} y a veces solo el número
    const pick = (v) => (typeof v === 'object' && v !== null) ? v.raw : v;

    const target = pick(fd.targetMeanPrice);
    const high = pick(fd.targetHighPrice);
    const low = pick(fd.targetLowPrice);
    const median = pick(fd.targetMedianPrice);
    const numAnalysts = pick(fd.numberOfAnalystOpinions);
    const currentPrice = pick(fd.currentPrice);
    const recommendationKey = fd.recommendationKey;
    const recommendationMean = pick(fd.recommendationMean);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ticker,
        target: target ?? null,
        high: high ?? null,
        low: low ?? null,
        median: median ?? null,
        numAnalysts: numAnalysts ?? null,
        currentPrice: currentPrice ?? null,
        recommendationKey: recommendationKey ?? null,
        recommendationMean: recommendationMean ?? null,
        source: 'yahoo',
      }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ticker, target: null, source: 'yahoo', error: e.message }),
    };
  }
};
